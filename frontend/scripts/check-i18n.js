#!/usr/bin/env node
/**
 * i18n Translation Key Checker
 * Compares translation files and reports missing keys
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const I18N_DIR = path.join(__dirname, '../src/i18n');
const LOCALES = ['en', 'zh-CN'];
const FILES = ['admin.json', 'common.json'];

// Recursively get all keys from an object
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

// Main check function
function checkTranslations() {
  let hasErrors = false;
  const allKeys = {};

  // Collect all keys from all locales
  for (const file of FILES) {
    allKeys[file] = {};

    for (const locale of LOCALES) {
      const filePath = path.join(I18N_DIR, locale, file);

      if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${locale}/${file}`);
        continue;
      }

      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        allKeys[file][locale] = new Set(getAllKeys(content));
      } catch (e) {
        console.error(`❌ Failed to parse ${locale}/${file}: ${e.message}`);
        hasErrors = true;
      }
    }
  }

  // Compare keys between locales
  for (const file of FILES) {
    const localeKeys = allKeys[file];
    const localeNames = Object.keys(localeKeys);

    if (localeNames.length < 2) continue;

    // Get union of all keys
    const allFileKeys = new Set();
    for (const locale of localeNames) {
      for (const key of localeKeys[locale]) {
        allFileKeys.add(key);
      }
    }

    // Check each locale for missing keys
    for (const locale of localeNames) {
      const missing = [];
      for (const key of allFileKeys) {
        if (!localeKeys[locale].has(key)) {
          missing.push(key);
        }
      }

      if (missing.length > 0) {
        hasErrors = true;
        console.log(`\n❌ Missing keys in ${locale}/${file}:`);
        missing.forEach(key => console.log(`   - ${key}`));
      }
    }
  }

  if (!hasErrors) {
    console.log('✅ All translation keys are in sync!');
  }

  return hasErrors ? 1 : 0;
}

process.exit(checkTranslations());
