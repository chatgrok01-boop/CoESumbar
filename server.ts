/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit 
} from "firebase/firestore";
import { fileURLToPath } from "url";
import { DISTRICT_AUTH } from "./src/constants";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from "fs";

// Initialize Firebase using the client SDK with API Key
const firebaseConfig = JSON.parse(fs.readFileSync("./firebase-applet-config.json", "utf8"));
console.log(`Initializing Firebase for project: ${firebaseConfig.projectId}, database: ${firebaseConfig.firestoreDatabaseId}`);

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

// Seed initial data if empty
async function seedData() {
  try {
    const q = query(collection(db, "events"), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      console.log("Seeding initial events...");
      const initialEvents = [
        {
          title: "Festival Siti Nurbaya",
          description: "Festival seni dan budaya tahunan Kota Padang yang menampilkan berbagai kesenian tradisional Minangkabau.",
          startDate: "2024-07-14",
          endDate: "2024-07-16",
          location: "Kawasan Kota Tua Padang",
          category: "Budaya",
          count: 5000,
          budget: 250000000,
          districtId: "padang",
          districtName: "Kota Padang",
          createdAt: new Date().toISOString()
        },
        {
          title: "Tour de Singkarak",
          description: "Kejuaraan balap sepeda internasional yang melewati berbagai objek wisata unggulan.",
          startDate: "2024-10-20",
          endDate: "2024-10-28",
          location: "Lintas Kabupaten/Kota",
          category: "Olahraga",
          count: 1200,
          budget: 5000000000,
          districtId: "provinsi",
          districtName: "Dinas Pariwisata Provinsi Sumbar",
          createdAt: new Date().toISOString()
        }
      ];
      
      for (const event of initialEvents) {
        await addDoc(collection(db, "events"), event);
      }
    }
  } catch (err) {
    console.error(`Warning: Seeding data failed: ${err.message}`);
    if (err.stack) console.error(err.stack);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.get("/api/db-test", async (req, res) => {
    try {
      const q = query(collection(db, "events"), limit(1));
      const snapshot = await getDocs(q);
      res.json({ status: "ok", size: snapshot.size, project: firebaseConfig.projectId, db: firebaseConfig.firestoreDatabaseId });
    } catch (err) {
      console.error("DB Test Failed:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  app.use(express.json());

  // API Routes
  
  // Login
  app.post("/api/login", (req, res) => {
    const { districtId, passcode } = req.body;
    
    if (!districtId || !passcode) {
      return res.status(400).json({ error: "Missing identity" });
    }

    if (DISTRICT_AUTH[districtId] === passcode) {
      // In a real app, we'd sign a JWT. Here we return success.
      return res.json({ 
        success: true, 
        role: districtId === "provinsi" ? "province" : "district" 
      });
    } else {
      return res.status(401).json({ error: "Invalid passcode" });
    }
  });

  // Holiday Proxy
  app.get("/api/holidays", async (req, res) => {
    try {
      const { year } = req.query;
      const targetYear = year || new Date().getFullYear();
      const response = await fetch(`https://api-harilibur.vercel.app/api?year=${targetYear}`);
      if (response.ok) {
        const data = await response.json();
        res.json(data);
      } else {
        console.warn(`Holiday API returned ${response.status}`);
        res.json([]); // Return empty list instead of error
      }
    } catch (err) {
      console.error("Holiday Proxy Error:", err);
      res.json([]); // Return empty list instead of error
    }
  });

  // Events
  app.get("/api/events", async (req, res) => {
    try {
      const q = query(collection(db, "events"), orderBy("startDate", "desc"));
      const snapshot = await getDocs(q);
      const events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      res.json(events);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.post("/api/events", async (req, res) => {
    try {
      const eventData = req.body;
      // Basic validation
      if (!eventData.title || !eventData.districtId) {
        return res.status(400).json({ error: "Invalid data" });
      }
      
      const docRef = await addDoc(collection(db, "events"), {
        ...eventData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      res.json({ id: docRef.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to save event" });
    }
  });

  app.put("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const eventData = req.body;
      
      await updateDoc(doc(db, "events", id), {
        ...eventData,
        updatedAt: new Date().toISOString()
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await deleteDoc(doc(db, "events", id));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to delete event" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Seed data background after server starts to ensure port 3000 is occupied quickly
    seedData();
  });
}

startServer();
