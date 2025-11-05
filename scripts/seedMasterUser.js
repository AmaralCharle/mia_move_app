#!/usr/bin/env node
/**
 * scripts/seedMasterUser.js
 * Usage:
 *   Set GOOGLE_APPLICATION_CREDENTIALS to point to your service account JSON (recommended),
 *   then run:
 *     node scripts/seedMasterUser.js --email usemiamove@gmail.com --password "senha123" --displayName "Mia Master" --projectId your-firebase-project-id
 *
 * What it does:
 * - Connects to Firebase Admin using the service account
 * - Ensures an Auth user exists with the provided email (creates one if missing)
 * - Creates/updates a Firestore document `users/{uid}` with role: 'master' and metadata
 *
 * NOTE: Keep your service account JSON private. Run this locally or on a secure CI runner.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = args[i+1] && !args[i+1].startsWith('--') ? args[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

async function main() {
  const argv = parseArgs();
  const email = argv.email;
  const password = argv.password || 'ChangeMe123!';
  const displayName = argv.displayName || 'Master User';
  const projectId = argv.projectId || process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT;

  if (!email) {
    console.error('Usage: --email user@example.com [--password pwd] [--displayName "Name"] [--projectId your-project-id]');
    process.exit(1);
  }

  // Initialize admin SDK. Prefer GOOGLE_APPLICATION_CREDENTIALS env var.
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: projectId
      });
    } catch (err) {
      console.error('Failed to initialize Firebase Admin SDK. Make sure GOOGLE_APPLICATION_CREDENTIALS is set or you provided ADC.');
      console.error(err);
      process.exit(1);
    }
  }

  try {
    // Try get user by email
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('Auth user found:', userRecord.uid);
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/user-not-found') {
        console.log('Auth user not found. Creating new auth user...');
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: false,
          password,
          displayName,
          disabled: false
        });
        console.log('Created auth user:', userRecord.uid);
      } else {
        throw err;
      }
    }

    const uid = userRecord.uid;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = {
      role: 'master',
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await userRef.set(userDoc, { merge: true });
    console.log('Firestore: created/updated users/' + uid);

    console.log('Done. The master user is ready.');
    console.log('UID:', uid);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding master user:', err);
    process.exit(1);
  }
}

main();
