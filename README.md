# SHARP 3D — Transform Photos to 3D

A stunning web application that converts any image into an interactive 3D scene using Apple's SHARP model for Gaussian splatting.

![SHARP 3D Preview](https://apple.github.io/ml-sharp/static/images/teaser.png)

## ✨ Features

- **Google OAuth Authentication** — Secure sign-in with email verification
- **Usage Limits & Payments** — 3 free scenes, then upgrade via Stripe
- **Drag & Drop Upload** — Beautiful, intuitive image upload interface
- **Apple SHARP Model** — State-of-the-art image-to-3D using Modal serverless GPUs
- **Interactive 3D Viewer** — Explore your Gaussian splat scene with mouse controls (rotate, zoom, pan)
- **3D Model Export** — Download the generated PLY file for use in other 3D applications
- **Scene History** — Your recent scenes are saved and shareable
- **Responsive Design** — Works beautifully on desktop and mobile
- **Fast Processing** — SHARP generates 3D in under a second on GPU

## 🚀 Quick Start

### Prerequisites

1. **Modal Account** — Sign up at [modal.com](https://modal.com)
2. **Vercel Account** — For deploying the web app
3. **Google Cloud Console** — For OAuth credentials
4. **Stripe Account** — For payment processing
5. **PostgreSQL Database** — Use Neon, Supabase, or Railway
6. **Python 3.10+** — For deploying the Modal endpoint

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

### Step 2: Set Up the Database

Create a PostgreSQL database and run migrations:

```bash
# Install dependencies
npm install

# Run Prisma migrations
npx prisma migrate deploy
```

### Step 3: Configure OAuth (Google)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable the Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Add authorized redirect URI: `https://your-domain.com/api/auth/callback/google`
6. Copy the Client ID and Client Secret

### Step 4: Set Up Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a Product with a one-time price for "Pro" access
3. Get your API keys from Developers → API keys
4. Set up a webhook endpoint: `https://your-domain.com/api/stripe/webhook`
5. Select the `checkout.session.completed` event

### Step 5: Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/apple-sharp)

Or deploy manually:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Step 6: Configure Environment Variables

In your Vercel project settings, add all required environment variables:

```bash
# Database
DATABASE_URL="postgresql://..."

# NextAuth.js
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Stripe
STRIPE_SECRET_KEY="sk_..."
STRIPE_PRICE_ID="price_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# App
NEXT_PUBLIC_APP_URL="https://your-domain.com"

# Modal
MODAL_ENDPOINT_URL="https://..."

# Vercel Blob (auto-added when you enable Blob storage)
BLOB_READ_WRITE_TOKEN="..."
```

### Step 7: Enable Vercel Blob Storage

1. Go to your project on Vercel
2. Navigate to **Storage** → **Create Database** → **Blob**
3. This automatically adds the `BLOB_READ_WRITE_TOKEN`

## 💻 Local Development

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file with all the variables from the `.env.example` file.

### 3. Set Up the Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (or push for development)
npx prisma db push
```

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🎮 Usage

1. **Sign In** — Use Google OAuth to create an account
2. **Upload an Image** — Drag and drop or click to select a photo (PNG, JPG, or WebP)
3. **Wait for Processing** — The image is processed via Modal (~1-10 seconds, longer on cold start)
4. **Explore in 3D** — Use your mouse to navigate the 3D Gaussian splat scene:
   - **Left-click + drag** — Rotate the view
   - **Scroll wheel** — Zoom in/out
   - **Right-click + drag** — Pan the view
5. **Share** — Copy the shareable link to share your 3D scene
6. **Upgrade** — After 3 free scenes, upgrade via Stripe for unlimited access

## 🏗️ Architecture

```
├── modal/
│   └── sharp_api.py          # Modal deployment for Apple Sharp
├── prisma/
│   └── schema.prisma         # Database schema (users, accounts)
├── app/
│   ├── components/
│   │   ├── AuthGate.tsx         # Authentication gate
│   │   ├── UpgradeModal.tsx     # Stripe payment modal
│   │   ├── ImageUpload.tsx      # Drag & drop upload zone
│   │   ├── GaussianViewer.tsx   # 3D model viewer (PLY Gaussian splats)
│   │   └── ProcessingStatus.tsx # Progress indicator
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts # NextAuth handler
│   │   ├── user/route.ts               # User data API
│   │   ├── stripe/
│   │   │   ├── checkout/route.ts       # Create checkout session
│   │   │   └── webhook/route.ts        # Handle Stripe webhooks
│   │   └── process/route.ts            # Image processing (authenticated)
│   ├── providers.tsx            # Session provider wrapper
│   ├── page.tsx                 # Main application page
│   └── globals.css              # Custom styling
├── lib/
│   ├── auth.ts                  # NextAuth configuration
│   ├── prisma.ts                # Prisma client
│   └── stripe.ts                # Stripe client
```

## 🛠️ Tech Stack

- **Framework** — [Next.js 16](https://nextjs.org/) with App Router
- **Authentication** — [NextAuth.js v5](https://authjs.dev/) with Google OAuth
- **Database** — [Prisma](https://prisma.io/) with PostgreSQL
- **Payments** — [Stripe](https://stripe.com/) Checkout
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
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Your app URL |
| `NEXTAUTH_SECRET` | Yes | Random secret for JWT signing |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret API key |
| `STRIPE_PRICE_ID` | Yes | Stripe price ID for Pro upgrade |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `NEXT_PUBLIC_APP_URL` | Yes | Your app URL (for redirects) |
| `MODAL_ENDPOINT_URL` | Yes | Your Modal Sharp endpoint URL |
| `BLOB_READ_WRITE_TOKEN` | Yes | Auto-provided by Vercel Blob |

### Usage Limits

- **Free tier**: 3 scene generations per user
- **Pro tier**: Unlimited scene generations (one-time payment)

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

1. You sign in with Google (email verification required)
2. You upload an image
3. The image is sent to Modal where the Sharp model runs on a GPU
4. Sharp analyzes the image and predicts a 3D Gaussian representation
5. The output PLY file is stored in Vercel Blob
6. The 3D viewer renders the Gaussian splats in your browser
7. Your usage count is incremented (tracked in the database)

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

### "Authentication required" error
Make sure you're signed in with Google. The app requires authentication to protect against abuse.

### "Usage limit reached" error
You've used all 3 free scenes. Click the upgrade button to purchase unlimited access.

### Slow first request
The first request after inactivity requires:
1. Starting the Modal container (~10-20s)
2. Loading the Sharp model (~10-20s)
3. Running inference (~1-5s)

Subsequent requests while the container is warm are much faster (~1-5s).

## 📝 License

This web interface is open source under the MIT License.
