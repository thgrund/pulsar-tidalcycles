const EventMapHelper = require('./event-map-helper')
const EventHighlightEvents = require('./event-highlight-events')
const EventHighlightWorkerEvents = require('./event-highlight-worker-events')

require("../polyfills/set");

const FRAME_RATE = 1000/30;

let messageBuffer = new Map();
let receivedThisFrame = new Map();

self.onmessage = function(e) {
  const event = e.data;

  if (event.type === EventHighlightEvents.OSC_MESSAGE) {
    queueEvent(event);
  } else if (event.type === EventHighlightEvents.RESET) {
    resetState();
  }
};

setInterval(() => {
    const {active, added, removed} = EventMapHelper.diffEventMaps(
      messageBuffer,
      receivedThisFrame,
    );

    postMessage({active, added, removed });
    messageBuffer = EventMapHelper.transformedEvents(added.union(active));
    receivedThisFrame.clear();

}, FRAME_RATE);

function resetState () {
  receivedThisFrame.clear();

  const {removed} = EventMapHelper.diffEventMaps(
    messageBuffer,
    receivedThisFrame,
  );

  postMessage({
     active: new Set(),
     added: new Set(),
     removed,
     type: EventHighlightWorkerEvents.RESET
  });

  messageBuffer.clear();
}

/** Helper that creates (or returns existing) nested maps. */
function ensureNestedMap(root, key) {
  if (!root.has(key)) root.set(key, new Map());
  return root.get(key);
}

/** Store events until the next animation frame */
function queueEvent(event) {
  const messageBufferMap = ensureNestedMap(messageBuffer, event.eventId);
  const recvMap = ensureNestedMap(receivedThisFrame, event.eventId);

  if (!recvMap.has(event.colStart)) {
    recvMap.set(event.colStart, event);
  }
}
