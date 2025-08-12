const EventMapHelper = require('./event-map-helper');
const EventHighlightEvents = require('./event-highlight-events');
const EventHighlightWorkerEvents = require('./event-highlight-worker-events');
require("../polyfills/set");

const FRAME_RATE = 1000 / 20;
const MISS_THRESHOLD = 1; // drop after 2 missed frames

let messageBuffer = new Map();
let receivedThisFrame = new Map();

self.onmessage = function (e) {
  const event = e.data;
  if (event.type === EventHighlightEvents.OSC_MESSAGE) {
    queueEvent(event);
  } else if (event.type === EventHighlightEvents.RESET) {
    resetState();
  }
};

setInterval(() => {
  // Build diff based on received events this frame
  const { active, added, removed } = EventMapHelper.diffEventMaps(
    messageBuffer,
    receivedThisFrame
  );

  const finalActive = new Set();
  const finalAdded = new Set(added);
  const finalRemoved = new Set();

  // 1. Process active events (reset missCount)
  active.forEach(evt => {
    evt.missCount = 0;
    finalActive.add(evt);
  });

  // 2. Process newly added events (missCount = 0)
  added.forEach(evt => {
    evt.missCount = 0;
    finalActive.add(evt);
  });

  // 3. Handle missing events — increment missCount, remove if threshold reached
  removed.forEach(evt => {
    evt.missCount = (evt.missCount || 0) + 1;
    if (evt.missCount < MISS_THRESHOLD) {
      finalActive.add(evt);
    } else {
      finalRemoved.add(evt);
      // Remove from buffer
      const cols = messageBuffer.get(evt.eventId);
      if (cols) {
        cols.delete(evt.colStart);
        if (cols.size === 0) {
          messageBuffer.delete(evt.eventId);
        }
      }
    }
  });

  // 4. Update messageBuffer with all active+added events
  messageBuffer = EventMapHelper.transformedEvents(
    [...finalActive, ...finalAdded]
  );

  // 5. Send results to main thread
  postMessage({
    active: finalActive,
    added: finalAdded,
    removed: finalRemoved,
  });

  // 6. Clear frame buffer
  receivedThisFrame.clear();
}, FRAME_RATE);

function resetState() {
  receivedThisFrame.clear();
  const { removed } = EventMapHelper.diffEventMaps(messageBuffer, receivedThisFrame);
  postMessage({
    active: new Set(),
    added: new Set(),
    removed,
    type: EventHighlightWorkerEvents.RESET,
  });
  messageBuffer.clear();
}

function ensureNestedMap(root, key) {
  if (!root.has(key)) root.set(key, new Map());
  return root.get(key);
}

function queueEvent(event) {
  const recvMap = ensureNestedMap(receivedThisFrame, event.eventId);
  if (!recvMap.has(event.colStart)) {
    recvMap.set(event.colStart, event);
  }
}
