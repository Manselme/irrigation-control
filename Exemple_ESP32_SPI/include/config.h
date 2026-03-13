/**
 * Configuration WiFi et Firebase - compatible SPI_Agri
 * 
 * À configurer : WiFi, API_KEY (clé web Firebase)
 * DATABASE_URL = même base que le site SPI_Agri
 */

#ifndef CONFIG_H
#define CONFIG_H

// --- 1. WIFI ---
#define WIFI_SSID "SFR_DD90"
#define WIFI_PASSWORD "azertyuiou"

// --- 2. FIREBASE (même base que SPI_Agri) ---
// Récupérer la clé API : Firebase Console → Paramètres du projet → Général → Vos applications → Clé Web
#define FIREBASE_API_KEY    "AIzaSyC7KAIFkkqG8FS7IS28cTi5vqEKSMFskus"

// URL de la Realtime Database (identique à FIREBASE_DATABASE_URL dans agriculture_monitoring.py)
#define FIREBASE_DATABASE_URL "https://esp32-spi-projet-default-rtdb.europe-west1.firebasedatabase.app"

#endif
