# 🏥 DiagnosisPro — Advanced AI-Powered Healthcare Platform

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg?style=for-the-badge&logo=react)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-Express-green.svg?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-emerald.svg?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Redux](https://img.shields.io/badge/Redux-593D88?style=for-the-badge&logo=redux&logoColor=white)](https://redux.js.org/)

**DiagnosisPro** is a state-of-the-art, secure, end-to-end encrypted digital healthcare ecosystem. It bridges the gap between patients, healthcare professionals, and diagnostic labs through modern AI assistance, secure video/chat consultations, medical prescription OCR processing, and seamless e-commerce pharmacy workflows.

---

## ✨ Detailed Features & Functionalities

### 🤖 1. AI-Powered Symptom Checker & Assistant
- **Stateful Conversational Agent**: Powered by **LangChain**, **LangGraph**, and the **Cohere API**, the system can handle multi-turn conversations. It retains contextual memory of the patient's symptoms, dynamically routes the conversation, and suggests appropriate specialists.
- **Prescription & Medical Report OCR**: Integrated with **Tesseract.js** to parse and extract critical medical information from uploaded documents and prescription images. The extracted text is processed by the AI to generate easy-to-understand medical summaries.

### 🔒 2. End-to-End Encrypted Chat & Real-Time Messaging
- **Client-Side Encryption**: Employs **AES-256 Symmetric Encryption** via **crypto-js**. All messages are encrypted before they leave the client and can only be decrypted locally by the intended recipient, guaranteeing absolute patient privacy.
- **Instant Messaging**: Powered by **Socket.io** for real-time, bidirectional, event-based communication between patients and doctors.

### 📹 3. WebRTC Video Consultations
- **In-Browser Video Calling**: High-quality, peer-to-peer audio and video consultations directly integrated into the platform without external plugins.
- **Custom Signaling**: Custom implementation of WebRTC signaling protocols using WebSockets to manage handshake data like offers, answers, and ICE candidates seamlessly.

### 💳 4. Pharmacy & Lab Test E-Commerce Module
- **Medicine Ordering System**: A complete marketplace allowing users to browse medicines, manage a shopping cart, and place orders based on valid prescriptions.
- **Diagnostic Lab Scheduler**: Enables patients to discover, book, and schedule at-home or in-clinic lab diagnostic tests.
- **Secure Payments**: Integrated with the **Razorpay Payment Gateway** to facilitate safe and reliable transactions for bookings and e-commerce checkouts.

### 🛡️ 5. Administrative Verification Panel
- **Doctor Credentialing**: A dedicated dashboard for platform administrators to vet and verify medical credentials and certificates uploaded by doctors. Protects the ecosystem by preventing fraudulent practitioner profiles.
- **Support Dashboard**: Real-time viewing and management of user inquiries (Contact Us queries) with full CRUD administrative capabilities.

### ⚙️ 6. Automated Reminders & Background Tasks
- **Scheduled Workers**: Powered by **node-cron** to automatically verify unattended appointments, update consultation statuses, and clean up database records efficiently in the background.
- **Transactional Notifications**: Integration of **Nodemailer** for sending critical alerts, OTP validation emails, and booking confirmations.

---

## 🛠️ Deep Dive: Technology Stack

This project is built using a modern JavaScript/TypeScript ecosystem for scalable, reliable, and real-time performance.

### 🖥️ Frontend Architecture (Client)
- **React.js & Vite**: The core library for building an interactive Single Page Application (SPA), bootstrapped with Vite for instant server start and lightning-fast Hot Module Replacement (HMR).
- **Tailwind CSS (v4)**: A utility-first CSS framework for rapidly building custom, responsive designs.
- **Redux Toolkit (RTK)**: Centralized state management for global application states, including authentication tokens, cart items, and admin operations.
- **Framer Motion**: Enables fluid, physics-based micro-interactions, layout transitions, and responsive modal animations.
- **Recharts**: For rendering analytical and interactive data visualizations (e.g., patient vitals and diagnostic summaries).
- **Socket.io-client**: Connects frontend views to the real-time backend signaling server.
- **Crypto-js**: Ensures payloads are encrypted client-side before transmission.
- **Lucide React**: Provides a standardized, clean set of vector icons.

### ⚙️ Backend Architecture (Server)
- **Node.js & Express.js**: A robust JavaScript runtime paired with Express.js to construct RESTful endpoints, API routers, and handle requests.
- **MongoDB & Mongoose**: A flexible NoSQL document database utilizing Mongoose for schema validation, data modeling, and relationship mapping.
- **Socket.io**: WebSockets implementation powering the real-time chat and WebRTC call signaling handshakes.
- **JWT & BcryptJS**: JSON Web Tokens for stateless, secure session authorization, paired with BcryptJS for high-entropy password hashing.
- **Cloudinary**: Cloud-based asset management to handle profile avatars and doctor identification documents.
- **Firebase Admin SDK**: Server-side validation of Google OAuth identity tokens to enable seamless third-party login.

### 🧠 AI, ML & Specialized Tooling
- **Cohere API**: The foundational Large Language Model (LLM) for generating intelligent responses, text classification, and symptom analysis.
- **LangChain / LangGraph**: Orchestration framework for building stateful, logic-driven AI agent workflows.
- **Tesseract.js**: The Optical Character Recognition (OCR) engine for parsing text directly from diagnostic images.

---

## 📂 Project Structure

```bash
HealthCare-App/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI Blocks (Navbar, Footer, Modals)
│   │   ├── layouts/        # Page Layouts (Dashboard templates)
│   │   ├── pages/          # Main Views (Login, Chat, Admin, ContactUs)
│   │   ├── store/          # Redux Slices (Auth, Cart, Admin slices)
│   │   └── utils/          # Client utilities (cryptoHelper, api, firebase)
│   └── package.json
│
├── server/                 # Node.js Express Backend
│   ├── models/             # Mongoose Schemas (User, Appointment, Order)
│   ├── routes/             # Express Routers (Auth, Admin, Contact, Chat)
│   ├── middleware/         # Auth filters and guards (JWT verification)
│   ├── utils/              # Backend helpers (chatbot graphs, encryption)
│   └── package.json
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- [MongoDB](https://www.mongodb.com/) (Local server or MongoDB Atlas Cluster)

### 1. Clone the Repository
```bash
git clone https://github.com/HealthCareApp01/NotSehatPulse.git
cd HealthCare-App
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_signature_key
COHERE_API_KEY=your_cohere_key
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
RAZORPAY_KEY_ID=your_razorpay_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
```

### 3. Server Setup
```bash
cd server
npm install
npm run dev     # Starts Nodemon backend server on port 5000
```

### 4. Client Setup
```bash
cd ../client
npm install
npm run dev     # Starts Vite local server on port 5173
```
