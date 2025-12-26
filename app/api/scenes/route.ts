import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/scenes - List all scenes for authenticated user
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only return scenes owned by this user
    const scenes = await prisma.scene.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        modelUrl: true,
        modelType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ scenes });
  } catch (error) {
    console.error("Error fetching scenes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/scenes - Delete a scene (requires scene ID in body)
export async function DELETE(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sceneId } = await request.json();

    if (!sceneId) {
      return NextResponse.json({ error: "Scene ID required" }, { status: 400 });
    }

    // Verify the scene belongs to this user before deleting
    const scene = await prisma.scene.findUnique({
      where: { id: sceneId },
      select: { userId: true },
    });

    if (!scene) {
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    if (scene.userId !== session.user.id) {
      // Don't reveal whether the scene exists to unauthorized users
      return NextResponse.json({ error: "Scene not found" }, { status: 404 });
    }

    await prisma.scene.delete({
      where: { id: sceneId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
