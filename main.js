"use strict";
const drawElements = []

class HandRects {
	constructor(video, ctx, settings) {
		const self = this;
		this.ctx = ctx;
		this.settings = settings;
		this.rects = [];
		
		this.hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
		this.hands.setOptions({modelComplexity: 1});
		this.hands.onResults(results => this.update(results));
		
		async function sendImage() {
			await self.hands.send({image: video});
			requestAnimationFrame(sendImage);	
		}
		
		requestAnimationFrame(sendImage);
	}
	
	update(results) {
		this.rects = results.multiHandLandmarks.map(landmarks => {
			let x = landmarks.map(mark => mark.x);
			let y = landmarks.map(mark => mark.y);
			let x_max = Math.max(...x) * this.settings.width;
			let x_min = Math.min(...x) * this.settings.width;
			let y_max = Math.max(...y) * this.settings.height;
			let y_min = Math.min(...y) * this.settings.height;
			
			return [x_min, y_min, x_max - x_min, y_max - y_min];
		});
	}
	
	draw() {
		for (let rect of this.rects)
			this.ctx.strokeRect(...rect);
		
		return true;
	}
}

navigator.mediaDevices.getUserMedia({audio: false, video: {width: 1280, height: 720}}).then(stream => {
	const video = document.querySelector('video');
	const canvas = document.querySelector('canvas');
	const ctx = canvas.getContext('2d');
	const settings = stream.getVideoTracks()[0].getSettings();
	
	canvas.width = settings.width;
	canvas.height = settings.height;
	video.srcObject = stream;
	
	drawElements.push(new HandRects(video, ctx, settings));
	
	async function draw() {
		ctx.clearRect(0, 0, settings.width, settings.height);
		drawElements.filter(element => element.draw());
		requestAnimationFrame(draw);	
	}
	
	requestAnimationFrame(draw);
});
