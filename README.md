# SHARP 3D — Transform Photos to 3D

A stunning web application that converts any image into an interactive 3D scene using cloud-based ML inference.

![SHARP 3D Preview](https://apple.github.io/ml-sharp/static/images/teaser.png)

## ✨ Features

- **Drag & Drop Upload** — Beautiful, intuitive image upload interface
- **Cloud Processing** — No local GPU required, uses Replicate for ML inference
- **Interactive 3D Viewer** — Explore your scene with mouse controls (rotate, zoom, pan)
- **3D Model Export** — Download the generated GLB file for use in other 3D applications
- **Responsive Design** — Works beautifully on desktop and mobile

## 🚀 Deploy to Vercel

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/apple-sharp&env=REPLICATE_API_TOKEN&envDescription=API%20tokens%20required%20for%20the%20app&envLink=https://replicate.com/account/api-tokens&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

### Manual Deployment

1. **Fork this repository**

2. **Get a Replicate API token**
   - Go to [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
   - Create a new API token

3. **Deploy to Vercel**
   ```bash
   # Install Vercel CLI
   npm i -g vercel

   # Deploy
   vercel
   ```

4. **Configure Environment Variables**
   In your Vercel project settings, add:
   - `REPLICATE_API_TOKEN` — Your Replicate API token

5. **Enable Vercel Blob Storage**
   - Go to your project on Vercel
   - Navigate to Storage → Create Database → Blob
   - This automatically adds the `BLOB_READ_WRITE_TOKEN`

## 💻 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API tokens:
- `REPLICATE_API_TOKEN` — Get from [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
- `BLOB_READ_WRITE_TOKEN` — Get from [Vercel Blob quickstart](https://vercel.com/docs/storage/vercel-blob/quickstart)

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Usage

1. **Upload an Image** — Drag and drop or click to select a photo (PNG, JPG, or WebP)
2. **Wait for Processing** — The image is processed in the cloud (~10-30 seconds)
3. **Explore in 3D** — Use your mouse to navigate the 3D scene:
   - **Left-click + drag** — Rotate the view
   - **Scroll wheel** — Zoom in/out
   - **Right-click + drag** — Pan the view
4. **Download** — Click the download button to save the GLB file

## 🏗️ Architecture

```
app/
├── components/
│   ├── ImageUpload.tsx      # Drag & drop upload zone
│   ├── GaussianViewer.tsx   # 3D model viewer (GLB + PLY support)
│   └── ProcessingStatus.tsx # Progress indicator
├── api/
│   └── process/
│       └── route.ts         # Image processing API (Vercel Blob + Replicate)
├── page.tsx                 # Main application page
├── layout.tsx               # Root layout with fonts
└── globals.css              # Custom styling & animations
```

## 🛠️ Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) with App Router
- **Styling** — [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations** — [Framer Motion](https://www.framer.com/motion/)
- **3D Rendering** — [Three.js](https://threejs.org/) with GLTF support
- **Icons** — [Lucide React](https://lucide.dev/)
- **ML Inference** — [Replicate](https://replicate.com/) (TripoSR model)
- **File Storage** — [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REPLICATE_API_TOKEN` | Yes | API token from Replicate |
| `BLOB_READ_WRITE_TOKEN` | Yes | Auto-provided by Vercel Blob |

### Vercel Configuration

The `vercel.json` file configures:
- **Function timeout**: 60 seconds for the processing API (to handle ML inference time)

## 📚 About the Technology

This app uses [TripoSR](https://github.com/VAST-AI-Research/TripoSR), a fast feed-forward 3D generation model developed by Stability AI and Tripo AI. Key features:

- **Fast Generation** — Creates 3D models in ~10-30 seconds
- **Single Image Input** — Works from just one photo
- **High Quality** — Produces detailed, textured 3D meshes
- **Zero-shot** — Works on any image without fine-tuning

## 🔗 Links

- [TripoSR on Replicate](https://replicate.com/camenduru/tripo-sr)
- [TripoSR GitHub](https://github.com/VAST-AI-Research/TripoSR)
- [SHARP Project Page](https://apple.github.io/ml-sharp/)
- [SHARP arXiv Paper](https://arxiv.org/abs/2512.10685)

## 📝 License

This web interface is open source under the MIT License.
