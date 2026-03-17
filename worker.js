"use strict";
import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs").then(({FilesetResolver, HandLandmarker}) =>
	FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm").then(vision =>
		HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
				delegate: "GPU"
			},
			runningMode: "VIDEO",
			numHands: 4,
			minHandDetectionConfidence: 0.3,
			minTrackingConfidence: 0.2
		})
	)
).then(hands => {
	postMessage(null);
	
	onmessage = ({data: frame}) => {
		Object.defineProperty(frame, 'width', {value: frame.displayWidth});
		Object.defineProperty(frame, 'height', {value: frame.displayHeight});
		postMessage(hands.detectForVideo(frame, frame.timestamp / 1000).landmarks);
		frame.close();
	};
}).catch(error => setTimeout(() => {throw error}));
