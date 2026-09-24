import Medicine from '../../models/Medicine.js';
import LabTest from '../../models/LabTest.js';

export async function matchMedicinesInDatabase(extractedMeds) {
  const matchedList = [];
  try {
    const dbMeds = await Medicine.find({});
    
    for (const item of extractedMeds) {
      let matched = null;
      let highestScore = 0;
      const extName = (item.name || "").toLowerCase().trim();
      
      if (!extName) continue;

      // Try smart matching against database medicines
      for (const med of dbMeds) {
        const dbName = med.name.toLowerCase().trim();
        
        // Scenario 1: Exact match
        if (dbName === extName) {
          matched = med;
          break;
        }
        
        // Scenario 2: DB contains Extracted or vice versa
        if (dbName.includes(extName) || extName.includes(dbName)) {
          const score = Math.min(dbName.length, extName.length) / Math.max(dbName.length, extName.length);
          if (score > highestScore) {
            highestScore = score;
            matched = med;
          }
        }

        // Scenario 3: Token matching (overlap)
        const dbTokens = dbName.split(/\s+/).filter(t => t.length > 2);
        const extTokens = extName.split(/\s+/).filter(t => t.length > 2);
        const intersections = dbTokens.filter(t => extTokens.includes(t));
        if (intersections.length > 0) {
          const score = intersections.length / Math.max(dbTokens.length, extTokens.length);
          if (score > highestScore) {
            highestScore = score;
            matched = med;
          }
        }
      }

      // If matched, populate database product info
      if (matched) {
        const tabletsPerPack = matched.tabletsPerPacket || 10;
        const prescribedTablets = item.quantity || 1;
        const packetsCeil = Math.ceil(prescribedTablets / tabletsPerPack);

        matchedList.push({
          name: matched.name,
          description: matched.description || item.dosage || "Extracted from prescription",
          price: matched.price,
          productId: matched._id.toString(),
          brand: matched.brand || "Generics",
          category: matched.category || "Prescription",
          prescribedTablets: prescribedTablets,
          tabletsPerPacket: tabletsPerPack,
          quantity: packetsCeil, // Ceil value of packets
          unmatched: false
        });
      } else {
        // Unavailable medicine: no fallback product, marked unmatched
        const tabletsPerPack = 10;
        const prescribedTablets = item.quantity || 1;
        const packetsCeil = Math.ceil(prescribedTablets / tabletsPerPack);

        matchedList.push({
          name: item.name,
          description: item.dosage || "Extracted from prescription",
          price: 0,
          productId: null,
          brand: "Generic",
          category: "Prescription",
          prescribedTablets: prescribedTablets,
          tabletsPerPacket: tabletsPerPack,
          quantity: packetsCeil, // Ceil value of packets
          unmatched: true
        });
      }
    }
  } catch (error) {
    console.error("❌ Error matching medicines in DB:", error);
  }
  return matchedList;
}

export async function matchLabTestsInDatabase(extractedTests) {
  const matchedList = [];
  try {
    const dbTests = await LabTest.find({});
    
    for (const item of extractedTests) {
      let matched = null;
      let highestScore = 0;
      const extName = (item.name || "").toLowerCase().trim();
      
      if (!extName) continue;

      // Try smart matching against database lab tests
      for (const test of dbTests) {
        const dbName = test.name.toLowerCase().trim();
        
        if (dbName === extName) {
          matched = test;
          break;
        }
        
        if (dbName.includes(extName) || extName.includes(dbName)) {
          const score = Math.min(dbName.length, extName.length) / Math.max(dbName.length, extName.length);
          if (score > highestScore) {
            highestScore = score;
            matched = test;
          }
        }

        const dbTokens = dbName.split(/\s+/).filter(t => t.length > 2);
        const extTokens = extName.split(/\s+/).filter(t => t.length > 2);
        const intersections = dbTokens.filter(t => extTokens.includes(t));
        if (intersections.length > 0) {
          const score = intersections.length / Math.max(dbTokens.length, extTokens.length);
          if (score > highestScore) {
            highestScore = score;
            matched = test;
          }
        }
      }

      if (matched) {
        matchedList.push({
          name: matched.name,
          description: matched.description || "Extracted from prescription",
          price: matched.price,
          productId: matched._id.toString(),
          brand: matched.brand || "Generics",
          category: matched.category || "Lab Test",
          quantity: 1,
          unmatched: false
        });
      } else {
        matchedList.push({
          name: item.name,
          description: "Extracted from prescription",
          price: 0,
          productId: null,
          brand: "Generic",
          category: "Lab Test",
          quantity: 1,
          unmatched: true
        });
      }
    }
  } catch (error) {
    console.error("❌ Error matching lab tests in DB:", error);
  }
  return matchedList;
}
