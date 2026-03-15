"use strict";
import {FilesetResolver, HandLandmarker} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";

const PI2 = Math.PI * 2;
const video = document.querySelector('video');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');
const actx = new AudioContext();
let drawObjects = [];

function areColliding(rect, circle) {
	let deltaX = Math.abs(circle.x - Math.max(rect[0], Math.min(circle.x, rect[0] + rect[2])));
	let deltaY = Math.abs(circle.y - Math.max(rect[1], Math.min(circle.y, rect[1] + rect[3])));
	return deltaX <= circle.radius && deltaY <= circle.radius && (deltaX * deltaX + deltaY * deltaY) <= circle.radiusSqr;
}

class HandRects {
	constructor() {
		this.rects = [];
		this.ready = this.init();
	}

	async init() {
		const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");

		this.hands = await HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
				delegate: "GPU"
			},
			runningMode: "VIDEO",
			numHands: 4,
			minHandDetectionConfidence: 0.3,
			minTrackingConfidence: 0.2
		});
	}

	async start(settings) {
		const self = this;
		self.settings = settings;

		try {
			await self.ready;
		}
		catch(e) {
			ctx.fillStyle = "red";
			return console.error(e);
		}

		function sendImage(time) {
			self.update(self.hands.detectForVideo(video, time));
			requestAnimationFrame(sendImage);
		}

		requestAnimationFrame(sendImage);
	}

	update(results) {
		this.rects = results.landmarks.map(landmarks => {
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
			ctx.strokeRect(...rect);

		return true;
	}
}

const durationMean = .1;
const durationDeviation = .025;
let randomDuration = () => durationMean;

import('https://luiscastro193.github.io/PRNG/PRNG.js').then(async module => {
	randomDuration = await module.distribution('gamma', durationMean, durationDeviation, await module.generator());
});

function playSound() {
	let oscillator = actx.createOscillator();
	oscillator.connect(actx.destination);
	oscillator.start();
	oscillator.stop(actx.currentTime + randomDuration());
}

const maxColor = 0xFFFFFF + 1;

class Ball {
	constructor(hands, settings) {
		this.hands = hands;
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
	}
	
	changeColor() {
		ctx.fillStyle = '#' + Math.trunc(Math.random() * maxColor).toString(16).padStart(6, '0');
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
		this.x += this.dx * time;
		this.y += this.dy * time;
		
		this.x = Math.min(Math.max(this.radius, this.x), this.rightLimit);
		this.y = Math.min(Math.max(this.radius, this.y), this.bottomLimit);
		
		this.detectCollisions();
		
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, PI2);
		ctx.fill();
		
		return true;
	}
}

const hands = new HandRects();
drawObjects.push(hands);

navigator.mediaDevices.getUserMedia(
	{audio: false, video: {facingMode: 'user', width: 1280, height: 720, resizeMode: 'crop-and-scale'}}
).then(stream => {
	video.addEventListener('play', async function() {
		const settings = stream.getVideoTracks()[0].getSettings();
		canvas.width = settings.width;
		canvas.height = settings.height;
		drawObjects.push(new Ball(hands, settings));
		await hands.start(settings);
		
		let lastTime = performance.now();
		
		function draw(time) {
			const elapsedTime = time - lastTime;
			lastTime = time;
			ctx.clearRect(0, 0, settings.width, settings.height);
			drawObjects = drawObjects.filter(object => object.draw(elapsedTime));
			requestAnimationFrame(draw);	
		}
		
		requestAnimationFrame(draw);
	}, {once: true});
	
	video.srcObject = stream;
});

function autoHideCursor(element, timeout = 1000) {
	let timer;
	
	function setTimer() {
		element.style.cursor = '';
		clearTimeout(timer);
		timer = setTimeout(() => {element.style.cursor = 'none'}, timeout);
	}
	
	element.addEventListener('mousemove', setTimer, {passive: true});
	setTimer();
}

autoHideCursor(canvas);
