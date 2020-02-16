import { initData } from './data/initData';
import LayersManager from './layers/LayersManager';
import { loadAssets } from './assets/loadAssets';
import { initStopDoingDumbShitProperties, setScene } from './scene/setScene';
import { addSlideControls } from './scene/setScene';
import { addNumberLabels } from './labels/numbers/addNumberLabels';
import { updateCamera } from './camera/updateCamera';
import { addVideo } from './slides/video/addVideo';
import { addAnimation } from './slides/animation/addAnimation';
import { addSupplements } from './supplements/addSupplements';
import DepthPass from './rendering/depthPass';
import IdPass from './rendering/idPass';
import { enterQuizz, enableQuizz, disableQuizz, leaveQuizz, updateQuizz } from './labels/numbers/quizz';
import { MeshIsolation } from './animations/meshIsolation';
import { initAudio } from './audio/initAudio';
import SlideQuiz from './slideQuiz/slideQuiz';
import bindLiveLabels from './labels/live/live-labels';
import { updateSpline } from './assets/spline';
import MaterialBuilder from './rendering/material-builder';
import Utils from './utils';
import InteractableGeometry from './geometry-teaching/interactable-geometry';

import * as THREE from 'three';

import { getBrowserCapabilities } from './check-browser';
import cloneObject from '../editor/helpers/cloneObject';

import Molecule from './chemistry/molecule';
import Atom from './chemistry/atom';

import AssessmentManager from './assessment/assessment-manager';
import CoilEmField from './coilEmField/coilEmField';

import AssetDeserializer from './assets/asset-deserializer';
import { setPP } from './rendering/animate';
import $ from 'jquery';

const useOldAssetLoader = false;
console.log(THREE);

window.AssessmentManager = AssessmentManager;
window.COOBO = window.COOBO || Utils.queryParams.has('coobo');

// window.$3dMol = $3dMol;

// import DriveAPI from "./api/drive-api";
//
// Q3.API = {
//   Cloud: {
//     Drive: DriveAPI
//   }
// };

// let selected = null;
// Object.defineProperty(Q3, "selected", {

//   get: () => selected,
//   set: val => {
//     console.trace()
//     return selected = val
//   }

// });

if (Utils.queryParams.has('nospam')) {
	THREE.Matrix3.NoSpam = THREE.Matrix4.NoSpam = true;
}

THREE.SkinnedMesh.prototype.raycast = (function() {
	var inverseMatrix = new THREE.Matrix4();
	var ray = new THREE.Ray();
	var sphere = new THREE.Sphere();

	var vA = new THREE.Vector3();
	var vB = new THREE.Vector3();
	var vC = new THREE.Vector3();

	var skinned = new THREE.Vector4();
	var skinVertex = new THREE.Vector4();
	var skinIndex = new THREE.Vector4();
	var skinWeight = new THREE.Vector4();
	var temp4 = new THREE.Vector4();

	var boneMatX = new THREE.Matrix4();
	var boneMatY = new THREE.Matrix4();
	var boneMatZ = new THREE.Matrix4();
	var boneMatW = new THREE.Matrix4();

	var tempA = new THREE.Vector3();
	var tempB = new THREE.Vector3();
	var tempC = new THREE.Vector3();

	var uvA = new THREE.Vector2();
	var uvB = new THREE.Vector2();
	var uvC = new THREE.Vector2();

	var barycoord = new THREE.Vector3();

	var intersectionPoint = new THREE.Vector3();
	var intersectionPointWorld = new THREE.Vector3();

	function uvIntersection(point, p1, p2, p3, uv1, uv2, uv3) {
		THREE.Triangle.barycoordFromPoint(point, p1, p2, p3, barycoord);

		uv1.multiplyScalar(barycoord.x);
		uv2.multiplyScalar(barycoord.y);
		uv3.multiplyScalar(barycoord.z);

		uv1.add(uv2).add(uv3);

		return uv1.clone();
	}

	function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
		var intersect;

		if (material.side === THREE.BackSide) {
			intersect = ray.intersectTriangle(pC, pB, pA, true, point);
		} else {
			intersect = ray.intersectTriangle(pA, pB, pC, material.side !== THREE.DoubleSide, point);
		}

		if (intersect === null) return null;

		intersectionPointWorld.copy(point);
		intersectionPointWorld.applyMatrix4(object.matrixWorld);

		var distance = raycaster.ray.origin.distanceTo(intersectionPointWorld);

		if (distance < raycaster.near || distance > raycaster.far) return null;

		return {
			distance: distance,
			point: intersectionPointWorld.clone(),
			object: object
		};
	}

	function applyBone(vec, attrSkinIndex, attrSkinWeight, index, bindMatrix, bindMatrixInverse, boneMatrices) {
		/*
      #ifdef USE_SKINNING
        vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
        vec4 skinned = vec4( 0.0 );
        skinned += boneMatX * skinVertex * skinWeight.x;
        skinned += boneMatY * skinVertex * skinWeight.y;
        skinned += boneMatZ * skinVertex * skinWeight.z;
        skinned += boneMatW * skinVertex * skinWeight.w;
        transformed = ( bindMatrixInverse * skinned ).xyz;
      #endif
    */

		skinIndex.fromBufferAttribute(attrSkinIndex, index);
		skinWeight.fromBufferAttribute(attrSkinWeight, index);

		boneMatX.fromArray(boneMatrices, skinIndex.x * 16);
		boneMatY.fromArray(boneMatrices, skinIndex.y * 16);
		boneMatZ.fromArray(boneMatrices, skinIndex.z * 16);
		boneMatW.fromArray(boneMatrices, skinIndex.w * 16);

		skinVertex.set(vec.x, vec.y, vec.z, 1).applyMatrix4(bindMatrix);

		skinned
			.set(0, 0, 0, 0)
			.add(
				temp4
					.copy(skinVertex)
					.applyMatrix4(boneMatX)
					.multiplyScalar(skinWeight.x)
			)
			.add(
				temp4
					.copy(skinVertex)
					.applyMatrix4(boneMatY)
					.multiplyScalar(skinWeight.y)
			)
			.add(
				temp4
					.copy(skinVertex)
					.applyMatrix4(boneMatZ)
					.multiplyScalar(skinWeight.z)
			)
			.add(
				temp4
					.copy(skinVertex)
					.applyMatrix4(boneMatW)
					.multiplyScalar(skinWeight.w)
			)
			.applyMatrix4(bindMatrixInverse);

		vec.set(skinned.x, skinned.y, skinned.z);
	}

	function checkBufferGeometryIntersection(object, raycaster, ray, position, uv, skinIndex, skinWeight, a, b, c) {
		const boneMatrices = object.skeleton.boneMatrices;
		const bindMatrix = object.bindMatrix;
		const bindMatrixInverse = object.bindMatrixInverse;

		applyBone(
			vA.fromBufferAttribute(position, a),
			skinIndex,
			skinWeight,
			a,
			bindMatrix,
			bindMatrixInverse,
			boneMatrices
		);
		applyBone(
			vB.fromBufferAttribute(position, b),
			skinIndex,
			skinWeight,
			b,
			bindMatrix,
			bindMatrixInverse,
			boneMatrices
		);
		applyBone(
			vC.fromBufferAttribute(position, c),
			skinIndex,
			skinWeight,
			c,
			bindMatrix,
			bindMatrixInverse,
			boneMatrices
		);

		var intersection = checkIntersection(object, object.material, raycaster, ray, vA, vB, vC, intersectionPoint);

		if (intersection) {
			if (uv) {
				uvA.fromBufferAttribute(uv, a);
				uvB.fromBufferAttribute(uv, b);
				uvC.fromBufferAttribute(uv, c);

				intersection.uv = uvIntersection(intersectionPoint, vA, vB, vC, uvA, uvB, uvC);
			}

			intersection.face = new THREE.Face3(a, b, c, THREE.Triangle.normal(vA, vB, vC));
			intersection.faceIndex = a;
		}

		return intersection;
	}

	return function(raycaster, intersects, animatedMesh) {
		if (!animatedMesh) {
			THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);

			return intersects;
		} else {
			var geometry = this.geometry;
			var material = this.material;
			var matrixWorld = this.matrixWorld;

			if (material === undefined) return;

			// Checking boundingSphere distance to ray

			if (geometry.boundingSphere === null) geometry.computeBoundingSphere();

			sphere.copy(geometry.boundingSphere);
			sphere.applyMatrix4(matrixWorld);

			if (raycaster.ray.intersectsSphere(sphere) === false) return;

			//

			inverseMatrix.getInverse(matrixWorld);
			ray.copy(raycaster.ray).applyMatrix4(inverseMatrix);

			// Check boundingBox before continuing

			if (geometry.boundingBox !== null) {
				if (ray.intersectsBox(geometry.boundingBox) === false) return;
			}

			var intersection;

			if (geometry.isBufferGeometry) {
				var a, b, c;
				var index = geometry.index;
				// var originalPosition = geometry.attributes.position;
				var position = geometry.attributes.position; //.clone();
				var attrSkinIndex = geometry.attributes.skinIndex;
				var attrSkinWeight = geometry.attributes.skinWeight;

				if (!attrSkinIndex || !attrSkinWeight) {
					THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);

					return intersects;
				}

				var uv = geometry.attributes.uv;
				var i, l;

				if (index !== null) {
					// indexed buffer geometry

					for (i = 0, l = index.count; i < l; i += 3) {
						a = index.getX(i);
						b = index.getX(i + 1);
						c = index.getX(i + 2);

						intersection = checkBufferGeometryIntersection(
							this,
							raycaster,
							ray,
							position,
							uv,
							attrSkinIndex,
							attrSkinWeight,
							a,
							b,
							c
						);

						if (intersection) {
							intersection.faceIndex = Math.floor(i / 3); // triangle number in indices buffer semantics
							intersects.push(intersection);
						}
					}
				} else if (position !== undefined) {
					// non-indexed buffer geometry

					for (i = 0, l = position.count; i < l; i += 3) {
						a = i;
						b = i + 1;
						c = i + 2;

						intersection = checkBufferGeometryIntersection(
							this,
							raycaster,
							ray,
							position,
							uv,
							attrSkinIndex,
							attrSkinWeight,
							a,
							b,
							c
						);

						if (intersection) {
							intersection.index = a; // triangle number in positions buffer semantics
							intersects.push(intersection);
						}
					}
				}
			} else {
				console.warn('Not supported geometry type.');
			}

			return intersects;
		}
	};
})();

// function filterLayersActions(data, ind) {
//   for (let l in data.layers.layers2D) {
//     for (let o in data.layers.layers2D[l].objects) {
//       let obj = data.layers.layers2D[l].objects[o];
//       obj.action.forEach( (a) => {
//         if (a && a.value && a.value.slide) {
//           const slide = Q3.data.slides[obj.action.value.slide];
//           if (slide && slide.visible === false) {
//             delete data.layers.layers2D[l].objects[o];
//           } else {
//             if (a.value.slide > ind) {
//               a.value.slide--;
//             }
//           }
//         }
//       })
//     }
//   }
// }

// export var stats = new Stats();
var Q3 = window.Q3;
export function start(elementId, data, editorMode) {
	initStopDoingDumbShitProperties();
	Q3.data = {}; //the empty JSON, before init with 'start'
	Q3.slide = 0;
	Q3.isTransitionning = false;
	Q3.callbacks = {}; //fire/listen
	Q3.Molecule = Molecule;
	Q3.Atom = Atom;
	Q3.CoilEmField = CoilEmField;
	Q3.AssetDeserializer = AssetDeserializer;
	Q3.editMode = !!editorMode;
	Q3.browserCapabilities = getBrowserCapabilities(Q3.editMode);
	Q3.isMobile = Q3.browserCapabilities.isMobile;
	Q3.materialBuilder = MaterialBuilder;
	Q3.setPP = setPP;

	if (Q3.isMobile) {
		document.body.classList.add('is-mobile');
	}
	if (data.setups.theme) {
		document.body.classList.add(data.setups.theme);
	}
	if (Q3.editMode) {
		Q3.draggableObjects = [];
	}
	Q3.listen = (eventName, callback) => {
		Q3.callbacks[eventName] = Q3.callbacks[eventName] || [];

		Q3.callbacks[eventName].push(callback);
	};

	Q3.unlisten = (eventName, callback) => {
		const eventCallbacks = Q3.callbacks[eventName];
		if (eventCallbacks) {
			var index = eventCallbacks.indexOf(callback);
			if (index > -1) {
				eventCallbacks.splice(index, 1);
			}
		}
	};

	Q3.setEnvLight = cube => {
		function createImg(base64) {
			var image = new Image();
			image.src = base64;
			return image;
		}

		const envMap = Q3.assets.envLight.cubeMap;
		for (let i = 0; i < cube.length; i++) {
			const mipmap = cube[i];
			envMap.mipmaps[i] = [
				createImg(mipmap.px),
				createImg(mipmap.nx),
				createImg(mipmap.py),
				createImg(mipmap.ny),
				createImg(mipmap.pz),
				createImg(mipmap.nz)
			];
		}
		envMap.needsUpdate = true;
		Q3.camera.update = true;
	};

	bindLiveLabels(Q3);

	Q3.fire = (eventName, event) => {
		if (Q3.callbacks[eventName]) {
			Q3.callbacks[eventName].forEach(f => {
				f(event);
			});
		}
	};

	initData(data); //Initializes default values when properties are empties.

	if (!data.highlightColor) {
		data.highlightColor = new THREE.Color('#77ff77').getHex();
	}
	if (!data.quizData) {
		data.quizData = {};
	}
	if (!data.setups.autoplayDelay) {
		data.setups.autoplayDelay = 4;
	}
	for (let i = 0; i < data.slides.length; i++) {
		// if (!Q3.editMode && data.slides[i].visible === false) {
		//   filterLayersActions(data, i);
		//   data.slides.splice(i, 1);
		//   i--;
		//   continue;
		// }
		if (!data.slides[i].cameraLimits) {
			data.slides[i].cameraLimits = {
				zoomLimitEnabled: false,
				minDistance: 0,
				maxDistance: 10,
				horizontalAngleLimitEnabled: false,
				minAzimuthAngle: -180,
				maxAzimuthAngle: 180,
				verticalAngleLimitEnabled: false,
				minPolarAngle: 0,
				maxPolarAngle: 90,
				enablePan: true
			};
		}
		if (!data.slides[i].controls) {
			data.slides[i].controls = {};
		}
		if (!('visible' in data.slides[i])) {
			data.slides[i].visible = true;
		}

		if (!('title' in data.slides[i])) {
			data.slides[i].title = 'Slide';
		}

		// if (!data.slides[i].slideQuiz) {
		//   data.slides[i].slideQuiz = new SlideQuiz();
		//   data.slides[i].slideQuizReset = JSON.stringify(data.slides[i].slideQuiz);
		// } else if (!(data.slides[i].slideQuiz instanceof SlideQuiz)) {
		let quizData = data.slides[i].slideQuiz;
		if (JSON.stringify(quizData) === '{}') {
			quizData = null;
		}
		data.slides[i].slideQuizReset = JSON.stringify(quizData);
		data.slides[i].slideQuiz = new SlideQuiz(quizData);
		// }

		if (!data.slides[i].envLight) {
			data.slides[i].envLight = data.assets.envLight || '/assets-qbix/F16EFB92-4B2C-46EB-8F86-8AC2322E4FAE.env';
		}

		if (!data.slides[i].fog) {
			data.slides[i].fog = data.setups.fog;
		}
	}
	try {
		if (!data.slides[0].layers2D) {
			let newLayers2D = {};
			// let layersCloned = {};

			data.slides.forEach(slideData => {
				let uuidMap = {};
				slideData.layers2D = {};
				Object.keys(data.layers.layers2D).forEach(uuid => {
					if (typeof slideData.layers[uuid] !== 'undefined') {
						if (slideData.layers[uuid] === true) {
							let newUuid = THREE.Math.generateUUID();
							uuidMap[uuid] = newUuid;
							newLayers2D[newUuid] = cloneObject(data.layers.layers2D[uuid]);
							slideData.layers2D[newUuid] = 1;
							slideData.layers[newUuid] = true;
							delete slideData.layers[uuid];
							Object.keys(newLayers2D[newUuid].objects).forEach(objUuid => {
								uuidMap[objUuid] = THREE.Math.generateUUID();
								newLayers2D[newUuid].objects[uuidMap[objUuid]] = cloneObject(
									newLayers2D[newUuid].objects[objUuid]
								);
								delete newLayers2D[newUuid].objects[objUuid];
								let oldMeshLineParentUuid =
									newLayers2D[newUuid].objects[uuidMap[objUuid]].meshLineParentUuid;
								if (oldMeshLineParentUuid && !data.layers.layers2D[oldMeshLineParentUuid]) {
									delete newLayers2D[newUuid].objects[uuidMap[objUuid]].meshLineParentUuid;
								}
								if (oldMeshLineParentUuid && data.layers.layers2D[oldMeshLineParentUuid]) {
									let newMeshLineParentUuid = uuidMap[oldMeshLineParentUuid];
									if (!newMeshLineParentUuid) {
										newMeshLineParentUuid = THREE.Math.generateUUID();
										uuidMap[oldMeshLineParentUuid] = newMeshLineParentUuid;
										slideData.layers[newMeshLineParentUuid] = Boolean(
											slideData.layers[oldMeshLineParentUuid]
										);
									}
									newLayers2D[newUuid].objects[
										uuidMap[objUuid]
									].meshLineParentUuid = newMeshLineParentUuid;
									slideData.layers[newMeshLineParentUuid] = Boolean(
										slideData.layers[oldMeshLineParentUuid]
									);
									delete slideData.layers[oldMeshLineParentUuid];
									slideData.layers2D[newMeshLineParentUuid] = 1;
									newLayers2D[newMeshLineParentUuid] = cloneObject(
										data.layers.layers2D[oldMeshLineParentUuid]
									);
									Object.keys(newLayers2D[newMeshLineParentUuid].objects).forEach(lineUuid => {
										uuidMap[lineUuid] = THREE.Math.generateUUID();
										newLayers2D[newMeshLineParentUuid].objects[uuidMap[lineUuid]] =
											newLayers2D[newMeshLineParentUuid].objects[lineUuid];
										delete newLayers2D[newMeshLineParentUuid].objects[lineUuid];
									});
								}
							});
						}
					}
				});
			});
			data.layers.layers2D = newLayers2D;
		}
	} catch (err) {
		console.log(err);
	}

	initAudio();

	//The method pop() puts its CB inside a settimeout 0 so that
	//we are sure that even on mobile, the splash has been set
	//when we start doing intensive CPU stuff
	Q3.splash.pop(elementId, () => {
		/* svg overlay */
		const NSString = 'http://www.w3.org/2000/svg'; //DevSkim: ignore DS137138
		let progressBar = $("<div id='mobile-progressbar'></div>");
		if (!Q3.nouicontrols) $('body').append(progressBar);
		// console.log(progressBar)

		const onAssetLoadCallback = p => {
			progressBar.width(p * 100 + '%');
			if (p >= 1) {
				progressBar.fadeOut();
				Q3.isFullyLoaded = true;
				Q3.analytics.loadingTime = new Date() - window.loadingStart + 'ms';
				Q3.renderManager.setHighlightObjects();
			}
		};

		if (useOldAssetLoader) {
			loadAssets(onAssetLoadCallback); //load the assets provided
		} else {
			AssetDeserializer.load({
				data: Q3.data,
				browserCapabilities: Q3.browserCapabilities,
				backgroundContainer: Q3.container,
				curSlide: Q3.slide,
				isEditMode: Q3.editMode
			}).then(onAssetLoadCallback);
		}

		Q3.meshIsolation = new MeshIsolation();

		setScene(editorMode);

		Q3.layers = new LayersManager(data);
		Q3.fire('layersready');

		Q3.container.appendChild(Q3.controls.autoCenterHelper);

		if (perfDebug) document.body.appendChild(stats.domElement);

		// addSlideControls();

		// Q3.depthPass = new DepthPass();
		// Q3.idPass = new IdPass();

		Q3.addNumberLabels = addNumberLabels;

		//addNumberLabels();//sets Q3.numberLabels

		/*Q3.numberLabelsQuizz = {
      counter: 0,
      enabled: false,
      enter: enterQuizz,
      leave: leaveQuizz,
      enable: enableQuizz,
      disable: disableQuizz,
      update: updateQuizz,
    };

    if (Q3.data.labels.number.enabled && Q3.data.labels.number.quizzing)

      Q3.numberLabelsQuizz.enable();*/

		updateCamera(); //adds camera

		//addVideo();

		addAnimation();
		Q3.addAnimation = addAnimation;
		Q3.updateSpline = updateSpline;

		addSupplements();

		let cameraLimits = Q3.data.slides[0].cameraLimits;

		if (cameraLimits.zoomLimitEnabled) {
			Q3.controls.minDistance = cameraLimits.minDistance;
			Q3.controls.maxDistance = cameraLimits.maxDistance;
		}

		if (cameraLimits.horizontalAngleLimitEnabled) {
			Q3.controls.minAzimuthAngle = (cameraLimits.minAzimuthAngle * Math.PI) / 180;
			Q3.controls.maxAzimuthAngle = (cameraLimits.maxAzimuthAngle * Math.PI) / 180;
		}

		if (cameraLimits.verticalAngleLimitEnabled) {
			Q3.controls.minPolarAngle = (cameraLimits.minPolarAngle * Math.PI) / 180;
			Q3.controls.maxPolarAngle = (cameraLimits.maxPolarAngle * Math.PI) / 180;
		}
		Q3.controls.enablePan = cameraLimits.enablePan;

		if (Q3.data.slides[0].controls) {
			if (Q3.data.slides[0].controls.interactionType === 'FPS') {
				Q3.controls.enabled = false;
				Q3.controls = Q3.FPSControls;
				Q3.controls.activate();
			}
		}

		if (!Q3.editMode) {
			Q3.analytics.initFPSlog();
		}
	});

	Q3.loadEnvLight = function(url) {
		Q3.loadEnvLight.cache = Q3.loadEnvLight.cache || {};
		if (Q3.loadEnvLight.cache[url]) {
			return Promise.resolve(Q3.loadEnvLight.cache[url]);
		}
		function base64ArrayBuffer(arrayBuffer) {
			var base64 = '';
			var encodings = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

			var bytes = new Uint8Array(arrayBuffer);
			var byteLength = bytes.byteLength;
			var byteRemainder = byteLength % 3;
			var mainLength = byteLength - byteRemainder;

			var a, b, c, d;
			var chunk;

			// Main loop deals with bytes in chunks of 3
			for (var i = 0; i < mainLength; i = i + 3) {
				// Combine the three bytes into a single integer
				chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];

				// Use bitmasks to extract 6-bit segments from the triplet
				a = (chunk & 16515072) >> 18; // 16515072 = (2^6 - 1) << 18
				b = (chunk & 258048) >> 12; // 258048   = (2^6 - 1) << 12
				c = (chunk & 4032) >> 6; // 4032     = (2^6 - 1) << 6
				d = chunk & 63; // 63       = 2^6 - 1

				// Convert the raw binary segments to the appropriate ASCII encoding
				base64 += encodings[a] + encodings[b] + encodings[c] + encodings[d];
			}

			// Deal with the remaining bytes and padding
			if (byteRemainder == 1) {
				chunk = bytes[mainLength];

				a = (chunk & 252) >> 2; // 252 = (2^6 - 1) << 2

				// Set the 4 least significant bits to zero
				b = (chunk & 3) << 4; // 3   = 2^2 - 1

				base64 += encodings[a] + encodings[b] + '==';
			} else if (byteRemainder == 2) {
				chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1];

				a = (chunk & 64512) >> 10; // 64512 = (2^6 - 1) << 10
				b = (chunk & 1008) >> 4; // 1008  = (2^6 - 1) << 4

				// Set the 2 least significant bits to zero
				c = (chunk & 15) << 2; // 15    = 2^4 - 1

				base64 += encodings[a] + encodings[b] + encodings[c] + '=';
			}

			return base64;
		}

		function readBuffer(buffer, ref) {
			const size = (buffer[ref.pos++] << 16) + (buffer[ref.pos++] << 8) + buffer[ref.pos++];

			var base64String = base64ArrayBuffer(buffer.slice(ref.pos, ref.pos + size));
			ref.pos += size;
			return 'data:image/png;base64,' + base64String;
		}

		function parseBinaryEnv(blob) {
			const arrayBuffer = new Uint8Array(blob);
			let pos = 0;
			const version = arrayBuffer[pos++];
			if (version === 0) {
				const levels = arrayBuffer[pos++];
				const ref = { pos: pos };
				const cubeData = [];
				for (let i = 0; i < levels; i++) {
					cubeData.push({
						px: readBuffer(arrayBuffer, ref),
						nx: readBuffer(arrayBuffer, ref),
						py: readBuffer(arrayBuffer, ref),
						ny: readBuffer(arrayBuffer, ref),
						pz: readBuffer(arrayBuffer, ref),
						nz: readBuffer(arrayBuffer, ref)
					});
				}

				return cubeData;
			} else {
				throw 'unsupported version of env light';
			}
		}

		return new Promise((resolve, reject) => {
			let xhr = new XMLHttpRequest();
			xhr.open('GET', url, true);
			xhr.responseType = 'blob';
			xhr.onload = function() {
				const blob = this.response;
				const fileReader = new FileReader();
				fileReader.onload = function(event) {
					event.target.result;
					const cubeData = parseBinaryEnv(event.target.result);
					Q3.loadEnvLight.cache[url] = cubeData;
					resolve(cubeData);
				};
				fileReader.readAsArrayBuffer(blob);
			};
			xhr.send();
		});
	};
}

// WEBPACK FOOTER //
// ./src/Q3/start.js
