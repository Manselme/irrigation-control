/**
 * Heltec WiFi LoRa 32 V3 - Contrôle vanne via Firebase
 * Compatible avec le site SPI_Agri (agriculture_monitoring.py)
 *
 * Mode STREAM : une seule connexion persistante, données reçues uniquement
 * quand /vanne/etat change → réduction drastique des connexions et du trafic.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <Firebase_ESP_Client.h>

#include <heltec_unofficial.h>

#include "config.h"

// Objets Firebase
FirebaseData stream;
FirebaseData streamMessage;
FirebaseAuth auth;
FirebaseConfig config;
bool signupOK = false;

// Flag et valeur pour le callback Stream (callback = contexte limité, on fait le travail en loop)
volatile bool vanneDataChanged = false;
volatile bool vanneEtat = false;
volatile bool messageDataChanged = false;
String vanneMessage = "";

void streamCallback(FirebaseStream data) {
  // Appelé uniquement quand /vanne/etat change (pas de polling = très peu de trafic)
  if (data.dataType() == "boolean") {
    vanneEtat = data.boolData();
    vanneDataChanged = true;
  }
}

void streamMessageCallback(FirebaseStream data) {
  if (data.dataType() == "string") {
    vanneMessage = data.stringData();
    messageDataChanged = true;
  }
}

void streamTimeoutCallback(bool timeout) {
  if (timeout) Serial.println("Stream timeout, reprise...");
}

void setup() {
  // IMPORTANT: activer VEXT avant tout - l'OLED du Heltec V3 est alimentée par VEXT
  heltec_ve(true);
  delay(10);

  heltec_setup();

  display.clear();
  display.drawString(0, 0, "Demarrage...");
  display.drawString(0, 20, "Connexion WiFi...");
  display.drawString(0, 40, WIFI_SSID);

  display.display();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    heltec_delay(300);
    Serial.print(".");
  }

  display.clear();
  display.drawString(0, 0, "WiFi OK !");
  display.drawString(0, 15, WiFi.localIP().toString());
  display.display();
  heltec_delay(2000);

  // --- CONFIGURATION FIREBASE ---
  config.api_key = FIREBASE_API_KEY;
  config.database_url = FIREBASE_DATABASE_URL;
  stream.setBSSLBufferSize(4096, 1024);

  if (Firebase.signUp(&config, &auth, "", "")) {
    Serial.println("Firebase Auth OK ");
    signupOK = true;

    display.clear();
    display.drawString(0, 0, "Connecte au Cloud");
    display.drawString(0, 20, "Stream actif...");
    display.display();

  } else {
    String errMsg = config.signer.signupError.message.c_str();
    Serial.printf("Erreur Auth: %s\n", errMsg.c_str());
    display.clear();
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 0, "Erreur Auth Firebase");
    display.drawString(0, 15, "Activez 'Anonymous'");
    display.drawString(0, 28, "dans Firebase Console");
    display.drawString(0, 45, "Auth > Sign-in method");
    display.display();
  }

  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  if (signupOK) {
    stream.keepAlive(5, 5, 1);
    streamMessage.keepAlive(5, 5, 1);
    if (!Firebase.RTDB.beginStream(&stream, "/vanne/etat"))
      Serial.printf("Stream begin error: %s\n", stream.errorReason().c_str());
    Firebase.RTDB.setStreamCallback(&stream, streamCallback, streamTimeoutCallback);
    if (!Firebase.RTDB.beginStream(&streamMessage, "/vanne/message"))
      Serial.printf("Stream message begin error: %s\n", streamMessage.errorReason().c_str());
    Firebase.RTDB.setStreamCallback(&streamMessage, streamMessageCallback, streamTimeoutCallback);
    vanneDataChanged = true;  // Premier affichage au démarrage
  }
}

void loop() {
  heltec_loop();

  if (!Firebase.ready() || !signupOK) {
    heltec_delay(500);
    return;
  }

  // Traitement des mises à jour reçues par le stream (sans polling)
  if (vanneDataChanged || messageDataChanged) {
    vanneDataChanged = false;
    messageDataChanged = false;
    bool etat = vanneEtat;
    String msg = vanneMessage;

    heltec_led(etat ? 100 : 0);

    display.clear();
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 0, "CONTROLE VANNE");
    display.setFont(ArialMT_Plain_16);
    if (etat)
      display.drawString(0, 20, ">> OUVERTE <<");
    else
      display.drawString(0, 20, "XX FERMEE XX");
    display.setFont(ArialMT_Plain_10);
    // Message personnalisé sous Ouvert/Fermé (max ~21 caractères pour une ligne 128px)
    if (msg.length() > 0) {
      String affiche = msg;
      if (affiche.length() > 21) affiche = affiche.substring(0, 21);
      display.drawString(0, 38, affiche);
    }
    display.drawString(0, 50, WiFi.localIP().toString());
    display.display();
  }

  // Boucle légère : pas de polling getBool, le stream envoie les données à la demande
  heltec_delay(100);
}
