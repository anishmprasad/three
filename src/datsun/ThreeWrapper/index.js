/* eslint-disable no-undef */
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
import TWEEN from '@tweenjs/tween.js';
// import Modal from 'datsun/modals/scene.gltf';
// import 'datsun/addons/GLTFLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

import './index.css';

console.log(TWEEN);

export default class ThreeWrapper extends Component {
	constructor() {
		super();
		this.scene = new THREE.Scene();
	}
	render() {
		return (
			<div className='three-wrapper'>
				<div id='three' />
				<div id='button' onClick={this.onClickButton}>
					button
				</div>
			</div>
		);
	}
	onClickButton = event => {
		console.log(event);
		// this.camera.rotation.y = (45 / 180) * Math.PI;
		// this.camera.position.x = 800;
		// this.camera.position.y = 800;
		// this.camera.position.z = 1000;
		// this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		// this.trackball = new TrackballControls(this.camera, this.renderer.domElement);
		// this.animate();
		// this.tweenAnimation();
		this.setupTween(this.camera.position.clone(), new THREE.Vector3(800, 800, 1000), 2500);
	};
	animate = () => {
		this.renderer.render(this.scene, this.camera);
		requestAnimationFrame(this.animate);
		TWEEN.update();
	};
	setupTween = (position, target, duration) => {
		// console.log(position, target, duration);
		TWEEN.removeAll(); // remove previous tweens if needed

		new TWEEN.Tween(position)
			.to(target, duration)
			.easing(TWEEN.Easing.Back.InOut)
			.onUpdate(() => {
				// debugger;
				// copy incoming position into capera position
				this.camera.position.copy(position);
				this.renderControls();
				this.renderTrackBallControls();
			})
			.start();
		this.animate();
	};
	renderControls = () => new OrbitControls(this.camera, this.renderer.domElement);
	renderTrackBallControls = () => new TrackballControls(this.camera, this.renderer.domElement);
	tweenAnimation = () => {
		this.controls.enabled = false;
		var duration = 2500;
		var position = new THREE.Vector3().copy(this.camera.position);
		var targetPosition = new THREE.Vector3(2.4, 2.2, -0.6);

		var tween = new TWEEN.Tween(position)
			.to(targetPosition, duration)
			.easing(TWEEN.Easing.Back.InOut)
			.onUpdate(function() {
				camera.position.copy(position);
				camera.lookAt(controls.target);
			})
			.onComplete(function() {
				camera.position.copy(targetPosition);
				camera.lookAt(controls.target);
				controls.enabled = true;
			})
			.start();
	};
	addLight = (x, y, z, color, intensity) => {
		var directionalLight = new THREE.DirectionalLight(color, intensity);
		directionalLight.position.set(x, y, z);
		this.scene.add(directionalLight);
	};

	onWindowResize = () => {
		this.camera.aspect = window.innerWidth / window.innerHeight;

		this.camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	};
	componentDidMount() {
		let hlight, directionalLight, light, light2, light3, light4, car;

		// scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xdddddd);
		this.camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 5000);
		this.camera.rotation.y = (45 / 180) * Math.PI;
		this.camera.position.x = 800;
		this.camera.position.y = 100;
		this.camera.position.z = 1000;
		this.renderer = new THREE.WebGLRenderer({ antialias: true });

		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.trackball = new TrackballControls(this.camera, this.renderer.domElement);

		// https://stackoverflow.com/questions/58626623/threejs-uncaught-typeerror-bc-call-is-not-a-function-orbit-controls
		// controls.addEventListener("change", renderer);
		hlight = new THREE.AmbientLight(0x404040, 100);
		this.scene.add(hlight);

		directionalLight = new THREE.DirectionalLight(0xffffff, 100);
		directionalLight.position.set(0, 1, 0);
		directionalLight.castShadow = true;
		this.scene.add(directionalLight);

		light = new THREE.PointLight(0xc4c4c4, 10);
		light.position.set(0, 300, 500);
		this.scene.add(light);

		light2 = new THREE.PointLight(0xc4c4c4, 10);
		light2.position.set(500, 100, 0);
		this.scene.add(light2);

		light3 = new THREE.PointLight(0xc4c4c4, 10);
		light3.position.set(0, 100, -500);
		this.scene.add(light3);

		light4 = new THREE.PointLight(0xc4c4c4, 10);
		light4.position.set(-500, 300, 500);
		this.scene.add(light4);

		//   renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.setSize(window.innerWidth, window.innerHeight);
		console.log(ReactDOM.findDOMNode(this));
		document.getElementById('three').appendChild(this.renderer.domElement);

		let loader = new GLTFLoader();
		loader.load('/modals/datsun/scene.gltf', gltf => {
			console.log(gltf);
			car = gltf.scene.children[0];
			car.scale.set(0.5, 0.5, 0.5);
			this.scene.add(gltf.scene);
			this.animate();
		});

		// function animate() {
		// 	renderer.render(this.scene, camera);
		// 	requestAnimationFrame(animate);
		// }
		// function addLight(x, y, z, color, intensity) {
		// 	var directionalLight = new THREE.DirectionalLight(color, intensity);
		// 	directionalLight.position.set(x, y, z);
		// 	this.scene.add(directionalLight);
		// }

		// function onWindowResize() {
		// 	camera.aspect = window.innerWidth / window.innerHeight;

		// 	camera.updateProjectionMatrix();

		// 	renderer.setSize(window.innerWidth, window.innerHeight);
		// }
		//var timer = Date.now() * 0.0005;            // optional for auto rotation

		//camera.position.x = Math.sin ( timer ) * 5; // optional for auto rotation
		//camera.position.z = Math.cos( timer ) * 5;  // optional for auto rotation
		// init();
	}
}
