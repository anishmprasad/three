/* eslint-disable no-undef */
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import * as THREE from 'three';
// import Modal from 'datsun/modals/scene.gltf';
// import 'datsun/addons/GLTFLoader';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

// console.log(Modal);

export default class ThreeWrapper extends Component {
	render() {
		return <div id='three' />;
	}
	componentDidMount() {
		let scene, camera, renderer, controls, trackball, hlight, directionalLight, light, light2, light3, light4, car;

		scene = new THREE.Scene();
		scene.background = new THREE.Color(0xdddddd);
		camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 5000);
		camera.rotation.y = (45 / 180) * Math.PI;
		camera.position.x = 800;
		camera.position.y = 100;
		camera.position.z = 1000;
		renderer = new THREE.WebGLRenderer({ antialias: true });

		controls = new OrbitControls(camera, renderer.domElement);
		trackball = new TrackballControls(camera, renderer.domElement);

		// https://stackoverflow.com/questions/58626623/threejs-uncaught-typeerror-bc-call-is-not-a-function-orbit-controls
		// controls.addEventListener("change", renderer);
		hlight = new THREE.AmbientLight(0x404040, 100);
		scene.add(hlight);

		directionalLight = new THREE.DirectionalLight(0xffffff, 100);
		directionalLight.position.set(0, 1, 0);
		directionalLight.castShadow = true;
		scene.add(directionalLight);

		light = new THREE.PointLight(0xc4c4c4, 10);
		light.position.set(0, 300, 500);
		scene.add(light);

		light2 = new THREE.PointLight(0xc4c4c4, 10);
		light2.position.set(500, 100, 0);
		scene.add(light2);

		light3 = new THREE.PointLight(0xc4c4c4, 10);
		light3.position.set(0, 100, -500);
		scene.add(light3);

		light4 = new THREE.PointLight(0xc4c4c4, 10);
		light4.position.set(-500, 300, 500);
		scene.add(light4);

		//   renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setSize(window.innerWidth, window.innerHeight);
		console.log(ReactDOM.findDOMNode(this));
		ReactDOM.findDOMNode(this).appendChild(renderer.domElement);

		let loader = new GLTFLoader();
		loader.load('/modals/datsun/scene.gltf', function(gltf) {
			console.log(gltf);
			car = gltf.scene.children[0];
			car.scale.set(0.5, 0.5, 0.5);
			scene.add(gltf.scene);
			animate();
		});

		function animate() {
			renderer.render(scene, camera);
			requestAnimationFrame(animate);
		}
		function addLight(x, y, z, color, intensity) {
			var directionalLight = new THREE.DirectionalLight(color, intensity);
			directionalLight.position.set(x, y, z);
			scene.add(directionalLight);
		}

		function onWindowResize() {
			camera.aspect = window.innerWidth / window.innerHeight;

			camera.updateProjectionMatrix();

			renderer.setSize(window.innerWidth, window.innerHeight);
		}
		//var timer = Date.now() * 0.0005;            // optional for auto rotation

		//camera.position.x = Math.sin ( timer ) * 5; // optional for auto rotation
		//camera.position.z = Math.cos( timer ) * 5;  // optional for auto rotation
		// init();
	}
}
