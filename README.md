# SHARP 3D — Transform Photos to 3D

A stunning web application that converts any image into an interactive 3D scene using Apple's SHARP model for Gaussian splatting.

![SHARP 3D Preview](https://apple.github.io/ml-sharp/static/images/teaser.png)

## ✨ Features

- **Drag & Drop Upload** — Beautiful, intuitive image upload interface
- **Apple SHARP Model** — State-of-the-art image-to-3D using Modal serverless GPUs
- **Interactive 3D Viewer** — Explore your Gaussian splat scene with mouse controls (rotate, zoom, pan)
- **3D Model Export** — Download the generated PLY file for use in other 3D applications
- **Responsive Design** — Works beautifully on desktop and mobile
- **Fast Processing** — SHARP generates 3D in under a second on GPU

## 🚀 Quick Start

### Prerequisites

1. **Modal Account** — Sign up at [modal.com](https://modal.com)
2. **Vercel Account** — For deploying the web app
3. **Python 3.10+** — For deploying the Modal endpoint

### Step 1: Deploy the Sharp Model to Modal

```bash
# Install Modal CLI
pip install modal

# Authenticate with Modal
modal token new

# Navigate to the modal directory and deploy
cd modal
modal deploy sharp_api.py
```

After deployment, Modal will display your endpoint URL. It looks like:
```
https://YOUR_USERNAME--apple-sharp-sharpmodel-generate.modal.run
```

**Copy this URL** — you'll need it in the next step.

### Step 2: Deploy the Web App to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/apple-sharp&env=MODAL_ENDPOINT_URL&envDescription=Your%20Modal%20endpoint%20URL&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

Or deploy manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Step 3: Configure Environment Variables

In your Vercel project settings, add:
- `MODAL_ENDPOINT_URL` — Your Modal endpoint URL from Step 1

### Step 4: Enable Vercel Blob Storage

1. Go to your project on Vercel
2. Navigate to **Storage** → **Create Database** → **Blob**
3. This automatically adds the `BLOB_READ_WRITE_TOKEN`

## 💻 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file:

```bash
MODAL_ENDPOINT_URL=https://YOUR_USERNAME--apple-sharp-sharpmodel-generate.modal.run
BLOB_READ_WRITE_TOKEN=your_blob_token_here
```

### 3. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Usage

1. **Upload an Image** — Drag and drop or click to select a photo (PNG, JPG, or WebP)
2. **Wait for Processing** — The image is processed via Modal (~1-10 seconds, longer on cold start)
3. **Explore in 3D** — Use your mouse to navigate the 3D Gaussian splat scene:
   - **Left-click + drag** — Rotate the view
   - **Scroll wheel** — Zoom in/out
   - **Right-click + drag** — Pan the view
4. **Download** — Click the download button to save the PLY file

## 🏗️ Architecture

```
├── modal/
│   └── sharp_api.py          # Modal deployment for Apple Sharp
├── app/
│   ├── components/
│   │   ├── ImageUpload.tsx      # Drag & drop upload zone
│   │   ├── GaussianViewer.tsx   # 3D model viewer (PLY Gaussian splats)
│   │   └── ProcessingStatus.tsx # Progress indicator
│   ├── api/
│   │   └── process/
│   │       └── route.ts         # API route (calls Modal endpoint)
│   ├── page.tsx                 # Main application page
│   └── globals.css              # Custom styling
```

## 🛠️ Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) with App Router
- **Styling** — [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations** — [Framer Motion](https://www.framer.com/motion/)
- **3D Rendering** — [Three.js](https://threejs.org/) + [@mkkellogg/gaussian-splats-3d](https://github.com/mkkellogg/GaussianSplats3D)
- **Icons** — [Lucide React](https://lucide.dev/)
- **ML Inference** — [Modal](https://modal.com) (serverless GPU)
- **File Storage** — [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MODAL_ENDPOINT_URL` | Yes | Your Modal Sharp endpoint URL |
| `BLOB_READ_WRITE_TOKEN` | Yes | Auto-provided by Vercel Blob |

### Modal Configuration

The `modal/sharp_api.py` file configures:
- **GPU**: A10G (good performance/cost ratio)
- **Timeout**: 300 seconds
- **Container idle**: 300 seconds (keeps warm for faster subsequent requests)
- **Model caching**: Uses Modal Volume to cache the 1.4GB model weights

### Cost Estimation

Modal charges ~$0.000225/second for A10G GPU. Typical costs:
- **Cold start**: ~30-60 seconds (~$0.007-0.014)
- **Warm inference**: ~1-5 seconds (~$0.0002-0.001)
- **Idle container**: Free (scales to zero when not in use)

## 📚 About the Technology

This app uses [Apple SHARP](https://huggingface.co/apple/Sharp) (Sharp Monocular View Synthesis), a state-of-the-art model for generating 3D Gaussian splats from a single image.

### Key Features

- **Ultra-Fast Generation** — Creates 3D Gaussian splats in under a second on GPU
- **Single Image Input** — Works from just one photo
- **Photorealistic Output** — Produces detailed 3D Gaussian splat representations
- **Real-time Rendering** — Output can be rendered in real-time from novel viewpoints
- **Open Source** — Available under MIT license

### How It Works

1. You upload an image
2. The image is sent to Modal where the Sharp model runs on a GPU
3. Sharp analyzes the image and predicts a 3D Gaussian representation
4. The output PLY file is stored in Vercel Blob
5. The 3D viewer renders the Gaussian splats in your browser

## 🔗 Links

- [Apple SHARP on Hugging Face](https://huggingface.co/apple/Sharp)
- [Apple SHARP GitHub](https://github.com/apple/ml-sharp)
- [SHARP Project Page](https://apple.github.io/ml-sharp/)
- [SHARP arXiv Paper](https://arxiv.org/abs/2512.10685)
- [Modal Documentation](https://modal.com/docs)

## 🐛 Troubleshooting

### "Model is loading" error
The Modal container is starting up. This takes 30-60 seconds on cold start. Try again after waiting.

### "Cannot connect to Modal endpoint" error
Check that:
1. Your `MODAL_ENDPOINT_URL` is correct
2. The Modal app is deployed (`modal deploy sharp_api.py`)
3. Your Modal account is active

### Slow first request
The first request after inactivity requires:
1. Starting the Modal container (~10-20s)
2. Loading the Sharp model (~10-20s)
3. Running inference (~1-5s)

Subsequent requests while the container is warm are much faster (~1-5s).

## 📝 License

This web interface is open source under the MIT License.
