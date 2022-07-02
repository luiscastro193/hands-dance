"use strict";
const PI2 = Math.PI * 2;
const drawElements = []

function areColliding(rect, circle) {
	let deltaX = circle.x - Math.max(rect[0], Math.min(circle.x, rect[0] + rect[2]));
	let deltaY = circle.y - Math.max(rect[1], Math.min(circle.y, rect[1] + rect[3]));
	return (deltaX * deltaX + deltaY * deltaY) < (circle.radius * circle.radius);
}

class HandRects {
	constructor(video, ctx, settings) {
		const self = this;
		this.ctx = ctx;
		this.settings = settings;
		this.rects = [];
		
		this.hands = new Hands({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`});
		this.hands.setOptions({modelComplexity: 0});
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

class Ball {
	constructor(hands, ctx, settings) {
		this.hands = hands;
		this.ctx = ctx;
		this.diagonal = Math.sqrt(settings.width * settings.width + settings.height * settings.height);
		this.radius = this.diagonal / 40;
		this.x = settings.width / 2;
		this.y = settings.height / 2;
		this.dx = 0;
		this.dy = 0;
		this.speed = this.diagonal / 2000;
		this.rightLimit = settings.width - this.radius;
		this.bottomLimit = settings.height - this.radius;
		this.lastTime = performance.now();
	}
	
	collisionDirection(rect) {
		let centerX = rect[0] + rect[2] / 2;
		let centerY = rect[1] + rect[3] / 2;
		this.dx = this.x - centerX;
		this.dy = this.y - centerY;
		let factor = this.speed / Math.sqrt(this.dx * this.dx + this.dy * this.dy);
		this.dx *= factor;
		this.dy *= factor;
	}
	
	detectCollisions() {
		if (this.dx < 0 && this.x <= this.radius || this.dx > 0 && this.x >= this.rightLimit)
			this.dx = -this.dx;
		
		if (this.dy < 0 && this.y <= this.radius || this.dy > 0 && this.y >= this.bottomLimit)
			this.dy = -this.dy;
		
		for (let handRect of this.hands.rects) {
			if (areColliding(handRect, this))
				return this.collisionDirection(handRect);
		}
	}
	
	draw(time) {
		this.ctx.beginPath();
		this.ctx.arc(this.x, this.y, this.radius, 0, PI2);
		this.ctx.fill();
		
		this.detectCollisions();
		
		let timeDiff = time - this.lastTime;
		this.x += this.dx * timeDiff;
		this.y += this.dy * timeDiff;
		this.lastTime = time;
		
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
	
	let hands = new HandRects(video, ctx, settings);
	drawElements.push(hands);
	drawElements.push(new Ball(hands, ctx, settings));
	
	async function draw(time) {
		ctx.clearRect(0, 0, settings.width, settings.height);
		drawElements.filter(element => element.draw(time));
		requestAnimationFrame(draw);	
	}
	
	requestAnimationFrame(draw);
});
