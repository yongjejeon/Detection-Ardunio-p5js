#include <SharpIR.h>
#include <Adafruit_NeoPixel.h>
#define IR1_PIN  A0          // Sensor 1 
#define IR2_PIN  A1          // Sensor 2 
#define MODEL    20150       
#define LED_PIN    6         // NeoPixel data pin
#define NUM_LEDS   12

SharpIR sensor1(IR1_PIN, MODEL);
SharpIR sensor2(IR2_PIN, MODEL);

Adafruit_NeoPixel ring(NUM_LEDS, LED_PIN, NEO_GRB + NEO_KHZ800);

//sensed if less than 30. Must change this depending on the width of door.
const int DETECT_CM = 30;

enum State { //3 states, idels or one of the two sensors active S1 active first means IN
  IDLE,
  S1_ACTIVE,
  S2_ACTIVE
};

State state = IDLE;
unsigned long stateStart = 0;
const unsigned long TIMEOUT = 800;      //this logic is a timeout logic, its the maximum time
                                      //allowed between first and second sensor, if the second sensor is not triggered, the attempt is canceled.

//counter for ppl
int peopleCount = 0;

// Last event to send to p5.js:  1 = IN, -1 = OUT, 0 = none
int lastEvent = 0;

//preventing double count logic
bool armed = true;                      // ready to detect a new crossing
unsigned long lastNotClearTime = 0;     // last time any sensor saw something
const unsigned long CLEAR_DELAY = 600;  // ms both sensors must be clear

//updating led based on count if room is occupied its red if not its green
void updateRing() {
  ring.clear();
  if (peopleCount > 0) {
    for (int i = 0; i < NUM_LEDS; i++) {
      ring.setPixelColor(i, ring.Color(150, 0, 0));
    }
  } else {
    for (int i = 0; i < NUM_LEDS; i++) {
      ring.setPixelColor(i, ring.Color(0, 150, 0));
    }
  }
  ring.show();
}

//reset all counter
void resetCounter() {
  peopleCount = 0;
  lastEvent = 0;
  state = IDLE;
  armed = true;
  lastNotClearTime = millis();
  updateRing();
}

void setup() {
  Serial.begin(9600);   //serial port
  pinMode(LED_BUILTIN, OUTPUT);

  ring.begin();
  ring.setBrightness(25);   
  ring.show();
  updateRing();

  // Blink built-in LED once
  digitalWrite(LED_BUILTIN, HIGH);
  delay(200);
  digitalWrite(LED_BUILTIN, LOW);

  //handshake
  // Wait until p5.js sends something
  while (Serial.available() <= 0) {
    digitalWrite(LED_BUILTIN, HIGH);   // blink while waiting
    Serial.println("0,0");            // send dummy data: count=0, event=0
    delay(300);
    digitalWrite(LED_BUILTIN, LOW);
    delay(50);
  }
}

void loop() {
  // Wait for commands from p5.js (STEP or RESET)
  while (Serial.available()) {
    digitalWrite(LED_BUILTIN, HIGH); // ON while receiving data

    // Read one line as a command string
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();  // remove whitespace / \r

    lastEvent = 0;  // default: no new event

    if (cmd == "RESET") { //if command is reset, it rests
      resetCounter();
      Serial.print(peopleCount);
      Serial.print(',');
      Serial.println(lastEvent);  
      continue;                   //wait for next command
    }

    if (cmd == "STEP") {
      int d1 = sensor1.distance();  //reading distance sensor
      int d2 = sensor2.distance();

      bool s1 = (d1 > 0 && d1 < DETECT_CM); //s1 is true when object is less than 30 cm
      bool s2 = (d2 > 0 && d2 < DETECT_CM);

      unsigned long now = millis();

      //arming logic
      if (s1 || s2) {             //either the sensor sees somethings
        lastNotClearTime = now;
      } else {                //if both are clear meaning enought time since delay has passed
        if (!armed && (now - lastNotClearTime > CLEAR_DELAY)) {
          armed = true;
        }
      }
      //direction
      switch (state) {

        case IDLE:  //only if armed is true, it reacts. 
          if (armed) {
            if (s1 && !s2) { //sensor 1 sees but sensor 2 does not
              state = S1_ACTIVE;    //potential IN
              stateStart = now;
            } else if (s2 && !s1) { //other case
              state = S2_ACTIVE;    //potential OUT
              stateStart = now;
            }
          }
          break;

        case S1_ACTIVE:     //potential IN
          if (s2) {       //if we see s2 before time out,
            // Sequence: S1 then S2 -> IN
            peopleCount++;
            if (peopleCount < 0) peopleCount = 0;
            updateRing();
            lastEvent = 1;   // IN
            armed = false;
            lastNotClearTime = now;
            state = IDLE;
          } else if (!s1 || (now - stateStart > TIMEOUT)) {   //if time out then idle
            state = IDLE;
          }
          break;

        case S2_ACTIVE:
          if (s1) { //same idea for sensor 2
            peopleCount--;
            if (peopleCount < 0) peopleCount = 0;
            updateRing();
            lastEvent = -1;  // OUT
            armed = false;
            lastNotClearTime = now;
            state = IDLE;
          } else if (!s2 || (now - stateStart > TIMEOUT)) {
            state = IDLE;
          }
          break;
      }

      //sending data to p5js
      Serial.print(peopleCount);
      Serial.print(',');
      Serial.println(lastEvent);
    }
  } 

  digitalWrite(LED_BUILTIN, LOW); // OFF when idle
}
