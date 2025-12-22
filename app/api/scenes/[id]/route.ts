import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/scenes/[id] - Get a specific scene with ownership verification
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Find scene and verify ownership in one query
    const scene = await prisma.scene.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        modelUrl: true,
        modelType: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    // Verify ownership - don't reveal scene exists to unauthorized users
    if (scene.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    // Return scene without userId
    const { userId: _, ...sceneData } = scene;
    return NextResponse.json({ scene: sceneData });
  } catch (error) {
    console.error("Error fetching scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/scenes/[id] - Delete a specific scene
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify the scene belongs to this user before deleting
    const scene = await prisma.scene.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    if (scene.userId !== session.user.id) {
      // Don't reveal whether the scene exists to unauthorized users
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    await prisma.scene.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/scenes/[id] - Update scene name
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Verify the scene belongs to this user before updating
    const scene = await prisma.scene.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!scene) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    if (scene.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Scene not found" },
        { status: 404 }
      );
    }

    const updatedScene = await prisma.scene.update({
      where: { id },
      data: { name: name.trim() },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        modelUrl: true,
        modelType: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ scene: updatedScene });
  } catch (error) {
    console.error("Error updating scene:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
