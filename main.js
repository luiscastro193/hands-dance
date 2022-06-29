"use strict";
function getHandRects(handResults, settings) {
	return handResults.multiHandLandmarks.map(landmarks => {
		let x = landmarks.map(mark => mark.x);
		let y = landmarks.map(mark => mark.y);
		let x_max = Math.max(...x) * settings.width;
		let x_min = Math.min(...x) * settings.width;
		let y_max = Math.max(...y) * settings.height;
		let y_min = Math.min(...y) * settings.height;
		
		return [x_min, y_min, x_max - x_min, y_max - y_min];
	})
}

function drawHands(handResults, ctx, settings) {
	ctx.clearRect(0, 0, settings.width, settings.height);
	
	for (let rect of getHandRects(handResults, settings))
		ctx.strokeRect(...rect);
}

navigator.mediaDevices.getUserMedia({audio: false, video: true}).then(stream => {
	const video = document.querySelector('video');
	const canvas = document.querySelector('canvas');
	const ctx = canvas.getContext('2d');
	const settings = stream.getVideoTracks()[0].getSettings();
	
	canvas.width = settings.width;
	canvas.height = settings.height;
	video.srcObject = stream;
	
	const hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
	hands.setOptions({modelComplexity: 1});
	hands.onResults(results => drawHands(results, ctx, settings));
	
	async function draw() {
		await hands.send({image: video});
		requestAnimationFrame(draw);	
	}
	
	requestAnimationFrame(draw);
});
