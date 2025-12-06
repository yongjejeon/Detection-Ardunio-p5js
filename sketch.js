let port;             
let baudrate = 9600;    //matching speed from arduino

//Arduino data
let peopleCount = 0;  
let lastEvent = 0;      //1 meants entered, -1 means left

// Messages
let statusMessage = "Press SPACE to connect.";

// dictionary with key being count, value is GIF url.
let gifGroups = {
  0: [
    "https://media.tenor.com/hrisiYKNn6UAAAAj/you-may-now-enter-kourtlyn-wiggins.gif",
    "https://media1.tenor.com/m/IZF4HViktvgAAAAd/abbott-elementary-come-on-in.gif",
    "https://media1.tenor.com/m/ZGJod50ebXIAAAAd/you-want-to-come-in-invitation.gif"
  ],
  1: [
    "https://media.tenor.com/eIoZmG3L4fYAAAAi/yoshi-yoshi-tv.gif", 
    "https://media1.tenor.com/m/lANYAosZI4AAAAAd/yoshi-mario.gif" 
  ],
  2: [
    "https://media1.tenor.com/m/8Mt2eEPPSg4AAAAd/happy-birthday-dance.gif"  
  ],
  3: [
    "https://media1.tenor.com/m/cMvelryh5BAAAAAd/car.gif",
    "https://media1.tenor.com/m/ovq2B-ML6I4AAAAd/guys-hugging.gif"
  ],
  4: [
    "https://media1.tenor.com/m/ROTEC3I3vkQAAAAd/despicable-me.gif",
    "https://media1.tenor.com/m/onl3-G1xIGEAAAAd/walk-cross.gif"
  ],
  5: [
    "https://media1.tenor.com/m/K3shTb7Ow-MAAAAd/johnny-depp-movie.gif",
    "https://media1.tenor.com/m/iLYNgJj42gEAAAAd/dwight-the-office.gif",
    "https://media1.tenor.com/m/ywI3ImfzsvYAAAAd/nicolas-cage-who-are-you-people.gif",
    "https://media1.tenor.com/m/ZBuCuZ4Ms-oAAAAd/where-did-all-of-these-people-come-from-patrick.gif"
  ],
  6: [
    "https://media1.tenor.com/m/27Atub3mjoMAAAAd/jordan-stop-it.gif"
  ],
  7: [ 
    "https://media1.tenor.com/m/fTXGp5PtzscAAAAd/yoshi-luigi.gif"
  ],
  8: [ // 8 or more
    "https://media.tenor.com/uaqJICjtx4QAAAAM/that%27s-it-enough.gif"
  ]
};


let gifElement = null;     // current element 
let lastGifUrl = null;     // tracks so that no difs appear twice in a row
let lastPeopleCount = 0;   // to detect transitions

function setup() {
  createCanvas(windowWidth, windowHeight); //full size window
  textSize(18);
  fill(255);

  // Create serial port
  port = createSerial();

  //show gif for 0 people by default
  showGifForCount(0);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  // Resize active GIF to match new window
  if (gifElement) {
    gifElement.size(windowWidth, windowHeight);
  }
}

function keyPressed() {
  //space to connect
  if (key === " ") {
    setupSerial();
  }

  //f for full screen
  if (key === "f" || key === "F") {
    fullscreen(true);
  }

  //exit full screen
  if (keyCode === ESCAPE) {
    fullscreen(false);
  }

  //r to reset count
  if (key === "r" || key === "R") {
    resetCount();
  }
}

//setting up port connection as per example in class
function setupSerial() {
  if (!port.opened()) {
    port.open("Arduino", baudrate);
    statusMessage = "Connecting...";
    console.log("Connecting to Arduino...");
  } else {
    port.close();
    statusMessage = "Disconnected";
    console.log("Disconnected from Arduino.");
  }
}

//reset function to reset count to 0
function resetCount() {
  // Reset on the p5 side
  peopleCount = 0;
  lastPeopleCount = 0;
  statusMessage = "Manual reset to 0.";
  showGifForCount(0);
  console.log("People count manually reset to 0 in p5.");

  //Reset arduino
  if (port.opened()) {
    port.write("RESET\n");
    console.log("Sent RESET command to Arduino.");
  }
}

//getting correct gif depending on count
function getGifGroup(count) {
  if (count >= 8) {            //if count is 8 or more, display same gif
    return gifGroups[8];
  }
  return gifGroups[count];
}

// Pick a random URL from the group, avoid repeating the same one if possible
function pickGifForPeopleCount(count) {
  let group = getGifGroup(count);
  if (!group || group.length === 0) return null;

  let url;
  if (group.length === 1) {
    url = group[0];
  } else {
    do {
      let idx = floor(random(group.length));
      url = group[idx];
    } while (url === lastGifUrl);
  }

  lastGifUrl = url;
  return url;
}

//create and updating gif 
function showGifForCount(count) {
  // Remove previous gif element if any
  if (gifElement) {
    gifElement.remove();
    gifElement = null;
  }

  let url = pickGifForPeopleCount(count);
  if (!url) return;

  gifElement = createImg(url);
  gifElement.position(0, 0);
  gifElement.size(windowWidth, windowHeight);
  gifElement.style("pointer-events", "none");
}

function draw() {
  background(20);
  fill(255);

  //handshake
  if (port.opened()) {
    let data = port.readUntil("\n"); //reading line from ardunio
    if (data.length > 0) {            //if read, split the data by comma
      let parts = split(trim(data), ",");
      if (parts.length === 2) {
        let pc = int(parts[0]);
        if (!isNaN(pc) && pc >= 0) {
          peopleCount = pc;            //receiving count 
        }

        let ev = int(parts[1]);
        if (!isNaN(ev)) {
          lastEvent = ev;              //checking if entered or exited
        }

        if (lastEvent === 1) {
          statusMessage = "A person entered!";    
        } else if (lastEvent === -1) {
          statusMessage = "A person left!";
        }
      }
      // Send command back so Arduino does another update step
      port.write("STEP\n");
    } 
  }

  //gif logic based on count
  if (peopleCount !== lastPeopleCount) {  //if count does not match, update gif
    // Count changed -> update GIF for this count
    showGifForCount(peopleCount);

    console.log("People in room:", peopleCount);
  }

  lastPeopleCount = peopleCount;
}
