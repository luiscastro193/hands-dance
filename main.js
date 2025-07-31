"use strict";
const PI2 = Math.PI * 2;
const drawElements = [];
const video = document.querySelector('video');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const actx = new AudioContext();

function areColliding(rect, circle) {
	let deltaX = Math.abs(circle.x - Math.max(rect[0], Math.min(circle.x, rect[0] + rect[2])));
	let deltaY = Math.abs(circle.y - Math.max(rect[1], Math.min(circle.y, rect[1] + rect[3])));
	return deltaX <= circle.radius && deltaY <= circle.radius && (deltaX * deltaX + deltaY * deltaY) <= circle.radiusSqr;
}

class HandRects {
	constructor(video, canvas, ctx) {
		this.ctx = ctx;
		this.rects = [];
		
		this.hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
		this.hands.setOptions({
			modelComplexity: 0,
			maxNumHands: 4,
			minDetectionConfidence: 0.3,
			minTrackingConfidence: 0.2
		});
		this.ready = this.hands.send({image: canvas});
	}
	
	async start(settings) {
		const self = this;
		this.settings = settings;
		
		try {
			await this.ready;
		}
		catch(e) {
			this.ctx.fillStyle = "red";
			return console.error(e);
		}
		
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

const durationMean = .075;
const durationDeviation = .025;
let randomDuration = () => durationMean;

import('https://cdn.jsdelivr.net/npm/cephes/+esm').then(async module => {
	const cephes = module.default;
	await cephes.compiled;
	
	randomDuration = () => {
		let uniform;
		while ((uniform = Math.random()) === 0);
		return Math.max(durationMean + durationDeviation * cephes.ndtri(uniform), 0);
	};
});

function playSound() {
	let oscillator = actx.createOscillator();
	oscillator.connect(actx.destination);
	oscillator.start();
	oscillator.stop(actx.currentTime + randomDuration());
}

const maxColor = 0xFFFFFF + 1;

class Ball {
	constructor(hands, ctx, settings) {
		this.hands = hands;
		this.ctx = ctx;
		let diagonal = Math.sqrt(settings.width * settings.width + settings.height * settings.height);
		this.radius = diagonal / 40;
		this.x = settings.width / 2;
		this.y = settings.height / 2;
		this.dx = 0;
		this.dy = 0;
		this.speed = diagonal / 2000;
		this.radiusSqr = this.radius * this.radius;
		this.rightLimit = settings.width - this.radius;
		this.bottomLimit = settings.height - this.radius;
		this.lastTime = performance.now();
	}
	
	changeColor() {
		this.ctx.fillStyle = '#' + Math.trunc(Math.random() * maxColor).toString(16).padStart(6, '0');
	}
	
	collisionDirection(rect) {
		this.dx = this.x - (rect[0] + rect[2] / 2);
		this.dy = this.y - (rect[1] + rect[3] / 2);
		let factor = this.speed / Math.sqrt(this.dx * this.dx + this.dy * this.dy);
		this.dx *= factor;
		this.dy *= factor;
	}
	
	detectCollisions() {
		for (let handRect of this.hands.rects) {
			if (areColliding(handRect, this))
				return this.collisionDirection(handRect);
		}
		
		let newColor = false;
		
		if (this.dx < 0 && this.x <= this.radius || this.dx > 0 && this.x >= this.rightLimit) {
			this.dx = -this.dx;
			newColor = true;
		}
		
		if (this.dy < 0 && this.y <= this.radius || this.dy > 0 && this.y >= this.bottomLimit) {
			this.dy = -this.dy;
			newColor = true;
		}
		
		if (newColor) {
			this.changeColor();
			playSound();
		}
	}
	
	draw(time) {
		let timeDiff = time - this.lastTime;
		this.x += this.dx * timeDiff;
		this.y += this.dy * timeDiff;
		this.lastTime = time;
		
		this.x = Math.min(Math.max(this.radius, this.x), this.rightLimit);
		this.y = Math.min(Math.max(this.radius, this.y), this.bottomLimit);
		
		this.detectCollisions();
		
		this.ctx.beginPath();
		this.ctx.arc(this.x, this.y, this.radius, 0, PI2);
		this.ctx.fill();
		
		return true;
	}
}

const hands = new HandRects(video, canvas, ctx);
drawElements.push(hands);

navigator.mediaDevices.getUserMedia({audio: false, video: {width: 1280, height: 720}}).then(stream => {
	video.addEventListener('play', async function() {
		const settings = stream.getVideoTracks()[0].getSettings();
		canvas.width = settings.width;
		canvas.height = settings.height;
		drawElements.push(new Ball(hands, ctx, settings));
		
		function draw(time) {
			ctx.clearRect(0, 0, settings.width, settings.height);
			drawElements.filter(element => element.draw(time));
			requestAnimationFrame(draw);	
		}
		
		await hands.start(settings);
		requestAnimationFrame(draw);
	}, {once: true});
	
	video.srcObject = stream;
});
