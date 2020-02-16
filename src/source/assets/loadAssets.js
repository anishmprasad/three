import { getOnBeforeCompile } from './../rendering/getOnBeforeCompile';

import { computeFontSize } from '../2DObjects/TextLiveLabel';

import { IconCanvas, HotspotSpriteMaterial, generateSpriteGeometry } from 'assets/sprites/IconTexture';

//import THREE from "three";
import RenderManager from '../rendering/render-manager';
import { updateSpline } from './spline';

import MaterialBuilder from '../rendering/material-builder';
import RenderQuality from '../render-quality';
import Network from '../miniviews/network';
import { Utils } from '../utils';

import * as THREE from 'three';

console.log(THREE);

export function loadAssets(backgroundLoadProgress) {
	let texturesArray = Object.keys(window.Q3.data.assets.textures),
		lightsArray = Object.keys(window.Q3.data.assets.lights),
		materialsArray = Object.keys(window.Q3.data.assets.materials),
		objectsArray = Object.keys(window.Q3.data.assets.objects);

	window.Q3.assets = window.Q3.assets || {
		textures: {},
		geometries: {},
		lights: {},
		materials: {},
		objects: {},
		animations: {}
	};

	window.Q3.loaders = window.Q3.loaders || {};
	window.Q3.loaders.texture = window.Q3.loaders.texture || new THREE.TextureLoader();
	window.Q3.loaders.HDRCube = window.Q3.loaders.HDRCube || new THREE.HDRCubeTextureLoader();
	window.Q3.loaders.draco = window.Q3.loaders.draco || new THREE.DRACOLoader();
	window.Q3.loaders.gltf = window.Q3.loaders.gltf || new THREE.GLTFLoader();
	window.Q3.loaders.file = window.Q3.loaders.file || new THREE.FileLoader();

	function isMaterialInUse(uuid) {
		for (let i = 0; i < objectsArray.length; i++) {
			const objUuid = objectsArray[i];
			if (window.Q3.data.assets.objects[objUuid].material === uuid) {
				return true;
			}
		}
		return false;
	}

	function isTextureInUse(uuid) {
		if (uuid.startsWith('lensflare') || !!window.Q3.data.assets.textures[uuid].cube) {
			return true;
		}
		for (let i = 0; i < materialsArray.length; i++) {
			const matUuid = materialsArray[i];
			const mData = window.Q3.data.assets.materials[matUuid];
			const props = Object.keys(mData);

			for (let j = 0; j < props.length; j++) {
				const prop = props[j];
				if (mData[prop] === uuid) {
					return true;
				} else if (prop === 'layers') {
					if (
						mData[prop].find(x => {
							if (x.map && x.map === uuid) return true;
							if (x.normalMap && x.normalMap === uuid) return true;

							return false;
						})
					)
						return true;
				}
			}
		}
		for (let i = 0; i < window.Q3.data.slides.length; i++) {
			const slide = window.Q3.data.slides[i];
			if (uuid === slide.backgroundValue) {
				return true;
			}
		}
		return false;
	}

	// cleanup unused materials
	for (let i = 0; i < materialsArray.length; i++) {
		const matUuid = materialsArray[i];
		if (!isMaterialInUse(matUuid)) {
			console.warn('Removing unused material: ' + window.Q3.data.assets.materials[matUuid].name);
			delete window.Q3.data.assets.materials[matUuid];
		}
	}
	materialsArray = Object.keys(window.Q3.data.assets.materials);

	// cleanup unused textures
	for (let i = 0; i < texturesArray.length; i++) {
		const tUuid = texturesArray[i];
		if (!isTextureInUse(tUuid)) {
			console.warn('Removing unused texture: ' + window.Q3.data.assets.textures[tUuid].name);
			delete window.Q3.data.assets.textures[tUuid];
		}
	}
	texturesArray = Object.keys(window.Q3.data.assets.textures);

	loadGeometry().then(() => {
		createLights();
		createTextures();
		createEnvironmetLight();
		createMaterials();
		createObjects();
		bindSkeletons();

		window.Q3.camera.updateCamera();
		if (!window.Q3.editMode) {
			window.Q3.splash.removeProgress();
		}
		if (window.Q3.data.setups.autoStart !== false || window.Q3.editMode) {
			window.Q3.splash.remove();
			window.Q3.fire('splashremoved');
		} else {
			$('#start-tour-btn')
				.fadeIn()
				.on('click', () => {
					window.Q3.splash.remove();
					window.Q3.fire('splashremoved');
				});
		}

		//load the res of assets in a background
		initLoadQueue(backgroundLoadProgress);

		if (Utils.queryParams.has('cameraHelpers')) {
			window.Q3.data.slides.forEach(slide => {
				const scene = Network.getWorld(slide.camera.gate).scene;
				(() => {
					const material = new THREE.MeshBasicMaterial({
						color: Math.floor(0xffffff * Math.random()),
						side: THREE.DoubleSide,
						wireframe: true,
						depthTest: false,
						depthWrite: false,
						transparent: true,
						wireframeLinewidth: 4
					});
					const geometry = new THREE.SphereBufferGeometry(0.5, 32, 32);
					const mesh = new THREE.Mesh(geometry, material);

					mesh.position.copy(slide.camera.position);

					scene.add(mesh);
					// setTimeout(function () {
					//     mesh.parent.remove(mesh);
					//     material.dispose();
					//     geometry.dispose();
					// }, 30000);
				})();
			});
		}
	});

	var canvas = document.createElement('canvas');

	// http://code.google.com/p/explorercanvas/wiki/Instructions#Dynamically_created_elements
	if (!canvas.getContext) G_vmlCanvasManager.initElement(canvas);

	var ctx = canvas.getContext('2d');
	canvas.width = 1;
	canvas.height = 1;

	function createImage(fillStyle) {
		ctx.fillStyle = fillStyle;
		ctx.fillRect(0, 0, 1, 1);
		var img = document.createElement('img');
		let promise = new Promise((resolve, reject) => {
			img.onload = resolve;
		});
		img.src = canvas.toDataURL('image/png');
		return { image: img, promise: promise };
	}

	var whiteImage = createImage('rgb(255,255,255)');

	function isTexture(propertyName) {
		return (
			propertyName !== 'aoMapIntensity' && (propertyName.indexOf('map') > -1 || propertyName.indexOf('Map') > -1)
		);
	}

	function shouldIgnoreTextureProperty(propertyName) {
		if (propertyName.indexOf('Intensity') > -1) {
			return true;
		}

		/* This change makes it look too ugly on mobile so I commented it out
    //do not use roughnessMap in lq
    if (window.Q3.browserCapabilities.renderQuality < RenderQuality.NORMAL &&
        (propertyName === "roughnessMap" || propertyName === "metalnessMap")) {
        return true;
    }*/

		return false;
	}

	function shouldIgnoreTexture(textureUuid) {
		let ignore = true;
		for (let i = 0; i < materialsArray.length; i++) {
			const m = materialsArray[i];
			const mData = window.Q3.data.assets.materials[m];
			for (let k in mData) {
				if (mData[k] === textureUuid && isTexture(k) && !shouldIgnoreTextureProperty(k)) {
					ignore = false;
				}
			}
		}
		window.Q3.data.slides.forEach(s => {
			if (s.backgroundType === 'texture' && s.backgroundValue === textureUuid) {
				ignore = false;
			}
		});

		return ignore;
	}

	function createTextures() {
		const texturesArray = Object.keys(window.Q3.data.assets.textures);
		texturesArray.forEach(t => {
			const tData = window.Q3.data.assets.textures[t];

			if (!!tData.cube) {
				//cubetextures, only hdr now
				const cube = new THREE.CubeTexture([
					whiteImage.image,
					whiteImage.image,
					whiteImage.image,
					whiteImage.image,
					whiteImage.image,
					whiteImage.image
				]);
				//assign properties like cubemapping
				for (let k in tData) {
					if (cube.hasOwnProperty(k) && k !== 'PMREM') {
						cube[k] = tData[k];
					}
				}
				whiteImage.promise.then(() => {
					cube.needsUpdate = true;
				});
				window.Q3.assets.textures[t] = cube;
				window.Q3.assets.textures[t].uuid = t;
			} else if (!shouldIgnoreTexture(t)) {
				//regular textures
				const fillStyle = tData.dominantColor ? tData.dominantColor : 'rgb(120,120,120)';
				var img = createImage(fillStyle);
				const texture = new THREE.Texture(img.image);
				img.promise.then(() => {
					texture.needsUpdate = true;
				});
				window.Q3.camera.update = true;
				//assign properties like minfilter, etc
				for (let k in window.Q3.data.assets.textures[t]) {
					if (texture.hasOwnProperty(k)) {
						if (k === 'repeat') {
							Object.assign(texture.repeat, { x: tData[k][0], y: tData[k][1] });
							texture.anisotropy = 4;
						} else {
							texture[k] = window.Q3.data.assets.textures[t][k];
						}
					}
				}

				window.Q3.assets.textures[t] = texture;
				window.Q3.assets.textures[t].uuid = t;
			}
		});
	}

	function shouldIgnoreLight(lightType) {
		switch (lightType) {
			case 'AmbientLight':
			case 'Ambient':
				return false;
			case 'HemisphereLight':
			case 'DirectionalLight':
			case 'SpotLight':
			case 'PointLight':
			case 'RectAreaLight':
				return window.Q3.browserCapabilities.renderQuality < RenderQuality.NORMAL;
		}
	}

	function createLights() {
		lightsArray.forEach(l => {
			const lightData = window.Q3.data.assets.lights[l],
				color = lightData.color.indexOf('#') > -1 ? lightData.color : parseInt(lightData.color);
			if (!shouldIgnoreLight(lightData.type)) {
				let light;

				switch (lightData.type) {
					case 'AmbientLight':
					case 'Ambient':
						light = new THREE.AmbientLight(color, lightData.intensity);
						break;
					case 'HemisphereLight':
						light = new THREE.HemisphereLight(color, parseInt(lightData.groundColor), lightData.intensity);
						break;
					case 'DirectionalLight':
						light = new THREE.DirectionalLight(color, lightData.intensity);
						break;
					case 'SpotLight':
						light = new THREE.SpotLight(
							color,
							lightData.intensity,
							lightData.distance,
							lightData.angle,
							lightData.penumbra,
							lightData.decay
						);
						break;
					case 'PointLight':
						light = new THREE.PointLight(color, lightData.intensity, lightData.distance, lightData.decay);
						break;
					case 'RectAreaLight':
						light = new THREE.ReactAreaLight(color, lightData.intensity, lightData.width, lightData.height);
						break;
				}

				// if ( lightData.type === 'AmbientLight' )          light = new THREE.AmbientLight( color, lightData.intensity );
				// else if ( lightData.type === 'HemisphereLight' )  light = new THREE.HemisphereLight( color, parseInt( lightData.groundColor ), lightData.intensity );
				// else if ( lightData.type === 'DirectionalLight' ) light = new THREE.DirectionalLight( color, lightData.intensity );
				// else if ( lightData.type === 'SpotLight' )        light = new THREE.SpotLight( color, lightData.intensity, lightData.distance, lightData.angle, lightData.penumbra, lightData.decay );
				// else if ( lightData.type === 'PointLight' )       light = new THREE.PointLight( color, lightData.intensity, lightData.distance, lightData.decay );
				// else if ( lightData.type === 'RectAreaLight' )    light = new THREE.ReactAreaLight( color, lightData.intensity, lightData.width, lightData.height );

				if (!!light.shadow && lightData.type !== 'RectAreaLight' && lightData.type !== 'PointLight') {
					//reactarealight shadows are not working in threejs yet. | PointLight shadows are too expensive so we decided to disable them

					light.castShadow = !!lightData.castShadow;

					light.shadow.mapSize.set(1, 1).multiplyScalar(lightData.shadowResolution || 512);
					Object.assign(light.shadow.camera, {
						near: lightData.shadowNearPersp || 0.01,
						far: lightData.shadowFar || 1000
					});
					if (lightData.type === 'DirectionalLight') {
						Object.assign(light.shadow.camera, {
							near: lightData.shadowNearOrtho || 0.01,
							left: -lightData.shadowWidth / 2 || -5,
							right: lightData.shadowWidth / 2 || 5,
							bottom: -lightData.shadowHeight / 2 || -5,
							top: lightData.shadowHeight / 2 || 5
						});
					}
					light.shadow.camera.updateProjectionMatrix();
					light.shadow.bias = lightData.shadowBias || 0;
					light.castShadow = !!lightData.castShadow;
				}

				//Lights without shadows are lights that don't need positionning,
				//though they have pos/rot/scale properties (ambient, hemi).
				if (!!light.shadow) light.position.copy(lightData.position);

				if (lightData.lensflares) {
					const lensflares = lensEffect();
					light.add(lensflares);
					light.userData.lensflares = lensflares;
					lensflares.lensFlares.forEach(flare => {
						flare.scale = lightData.lensflaresScale || 1;
					});
				}

				light.uuid = l;
				light.name = lightData.name;

				window.Q3.assets.lights[l] = light;
			}
		});
	}

	function createMaterials() {
		const createIconHotspotMaterial = function(m, mData) {
			//Empty texture, will be replaced
			let texture = new THREE.Texture();
			texture.iconData = mData.iconData;
			texture.lastUpdate = new Date();

			//Material
			let hotspotMaterial = new HotspotSpriteMaterial(
				texture,
				new THREE.Vector2(mData.iconData.scaleX, mData.iconData.scaleY)
			);

			let material = hotspotMaterial.material;
			material.uuid = m;
			material.needsUpdate = true;

			let newMap = new IconCanvas(mData.iconData);

			newMap.draw().then(image => {
				let newTexture = new THREE.Texture(image);
				newTexture.needsUpdate = true;
				newTexture.iconData = mData.iconData;
				newTexture.lastUpdate = new Date();

				material._iconConstructor.setTexture(newTexture);
				material.needsUpdate = true;
			});

			return material;
		};

		materialsArray.forEach(m => {
			const mData = window.Q3.data.assets.materials[m];

			let material;

			if (mData.type && mData.type !== 7) {
				let params = { morphTargets: true };

				switch (mData.type) {
					case 0:
						material = new THREE.MeshBasicMaterial(params);
						break;
					case 1:
						material = new THREE.MeshLambertMaterial(params);
						break;
					case 2:
						material = new THREE.MeshPhongMaterial(params);
						break;
					case 3:
						material = MaterialBuilder.build({ materialType: mData.materialType, doNotSetValues: true });
						break;
					case 4:
						material = new THREE.PointsMaterial(params);
						break;
					case 5:
						material = new THREE.LineBasicMaterial(params);
						break;
					case 6:
						material = new THREE.SpriteMaterial();
						break;
				}

				material.uuid = m;
				material.onBeforeCompile = getOnBeforeCompile(material);

				if (
					mData['smoothClipEnd'] !== undefined &&
					mData['smoothClipStart'] &&
					mData['smoothClipEnabled'] === undefined
				) {
					mData.smoothClipEnabled = true;
				}

				for (let k in mData) {
					if (k === 'layers' && mData.materialType === 'nested') {
						material.setLayers(
							mData[k].map(x => {
								return {
									distance: new THREE.Vector2().fromArray(x.distance),
									map: x.map ? window.Q3.assets.textures[x.map] : null,
									normalMap: x.normalMap ? window.Q3.assets.textures[x.normalMap] : null
								};
							})
						);
					} else if (k === 'smoothClipEnd' || k === 'smoothClipStart') {
						material.uniforms[k].value = mData[k];
					} else if (k === 'smoothClipEnabled') {
						material.setSmoothClipEnabled(mData[k]);
					} else if (material[k] !== undefined && k !== 'type') {
						if (isTexture(k)) {
							const t = window.Q3.assets.textures[mData[k]];
							material[k] = t;
						} else if (['color', 'emissive', 'specular'].indexOf(k) > -1) {
							//if color

							material[k] = new THREE.Color(parseInt(mData[k]));
						} else if (['start', 'end'].indexOf(k) === -1) {
							//if other

							if (k === 'normalScale') {
								//it seems that earlier normalscale was {x, y} instead of just a number, this fixes it.
								if (typeof mData[k] !== 'number' && mData[k].x) material[k].set(mData[k].x, mData[k].x);
								else material[k].set(mData[k], mData[k]);
							} else {
								material[k] = mData[k];
							}
						}
					}
				}

				if (material.transparent) material.alphaTest = 0.01;
				material.envMap = window.Q3.assets.envLight.cubeMap;

				material.needsUpdate = true;
				window.Q3.assets.materials[m] = material;
			} else if (mData.type === 7) {
				material = createIconHotspotMaterial(m, mData);

				//Assets
				window.Q3.assets.materials[m] = material;
				window.Q3.assets.materials[m].uuid = m;
				window.Q3.assets.materials[m] = material;
			} else {
				let params = Object.assign({}, mData.script, { morphTargets: true });
				material = new THREE.ShaderMaterial(params);
				material.needsUpdate = true;
				window.Q3.assets.materials[m] = material;
				window.Q3.assets.materials[m].uuid = m;
			}
		});
	}

	function bindSkeletons() {
		const objects = objectsArray.map(o => {
			const oData = window.Q3.data.assets.objects[o];

			let object;

			switch (oData.type) {
				case 'SkinnedMesh':
					object = window.Q3.assets.objects[o];

					if (object && window.Q3.data.assets.skeletons[o]) {
						const skeletonData = window.Q3.data.assets.skeletons[o];

						const bindMatrices = [];
						for (let i = 0, len = skeletonData.inverses.length / 16; i < len; i++)
							bindMatrices.push(new THREE.Matrix4().fromArray(skeletonData.inverses, i * 16));

						const skeleton = new THREE.Skeleton(
							skeletonData.bones.map(id => window.Q3.assets.objects[id]),
							bindMatrices
						);

						object.material.skinning = true;
						object.material.needsUpdate = true;

						object.bind(skeleton, new THREE.Matrix4().fromArray(skeletonData.bind));
					}
					break;
			}
		});
	}

	function createObjects() {
		const objects = objectsArray.map(o => {
			const oData = window.Q3.data.assets.objects[o];

			let object;

			switch (oData.type) {
				case 'Object3D':
					object = new THREE.Object3D();
					break;
				case 'Gate':
					object = Network.createGate({ worldUuid: oData.world_id, parentUuid: oData.parent_world });
					break;
				case 'Mesh':
				case 'SkinnedMesh':
					object = new (oData.type === 'Mesh' ? THREE.Mesh : THREE.SkinnedMesh)(
						window.Q3.assets.geometries[oData.geometry],
						window.Q3.assets.materials[oData.material]
					);

					if (oData.type === 'SkinnedMesh') object.frustumCulled = false;

					RenderManager.raycaster.makeTrackable(object);

					object.castShadow = object.receiveShadow = true;

					if (oData.subType) {
						object.subType = oData.subType;
					}
					break;

				case 'Sprite':
					object = new THREE.Sprite(window.Q3.assets.materials[oData.material]);

					RenderManager.raycaster.makeTrackable(object);
					break;
				case 'Bone':
					object = new THREE.Bone();
					break;
				case 'Group':
				default:
					object = new THREE.Group();
					break;
			}

			for (let k in oData) {
				if (['material', 'geometry', 'type', 'parent'].indexOf(k) === -1) {
					if (['position', 'rotation', 'scale'].indexOf(k) > -1) {
						Object.assign(object[k], oData[k]);
					} else {
						object.hasOwnProperty(k) ? (object[k] = oData[k]) : (object.userData[k] = oData[k]);
					}
				}
			}

			window.Q3.assets.objects[o] = object;
			window.Q3.assets.objects[o].uuid = o;
			window.Q3.assets.objects[o].visible = window.Q3.data.slides[0].animation[o].visible !== false;

			return object;
		});

		objects.forEach(object => {
			//color change on slide 0 on load
			const anim = window.Q3.data.slides[0].animation[object.uuid];
			if (anim && anim.color) object.material.color.setHex(anim.color);
			if (anim && anim.opacity >= 0) object.material.opacity = anim.opacity;

			const asset = window.Q3.data.assets.objects[object.uuid];

			// if (!asset.parent_world) asset.parent_world = window.Q3.gateNetwork.currentWorldUuid;

			//parenting
			const parentUuid = asset.parent;
			let scene = window.Q3.scene;

			if (!parentUuid && asset.parent_world) {
				const parentWorld = Network.getWorld(asset.parent_world);
				if (parentWorld) scene = parentWorld.gate.scene;
			}

			(parentUuid ? window.Q3.assets.objects[parentUuid] : scene).add(object);

			//clipping planes setup
			const clipId = asset.clipMaterial;
			if (clipId) {
				const normalMat = new THREE.Matrix4();
				object.userData.plane = new THREE.Plane();
				object.onBeforeRender = () => {
					const normal = new THREE.Vector3(
						object.geometry.attributes.normal.array[0],
						object.geometry.attributes.normal.array[1],
						object.geometry.attributes.normal.array[2]
					);
					const point = new THREE.Vector3(
						object.geometry.attributes.position.array[0],
						object.geometry.attributes.position.array[1],
						object.geometry.attributes.position.array[2]
					);
					normalMat.identity().extractRotation(object.matrixWorld);
					normal.applyMatrix4(normalMat);
					point.applyMatrix4(object.matrixWorld);
					object.userData.plane.setFromNormalAndCoplanarPoint(normal, point);
				};

				window.Q3.assets.materials[clipId].clippingPlanes =
					window.Q3.assets.materials[clipId].clippingPlanes || [];
				window.Q3.assets.materials[clipId].clippingPlanes.push(object.userData.plane);
				window.Q3.assets.materials[clipId].clipShadows = true;
				window.Q3.assets.materials[clipId].needsUpdate = true;
			}

			if (asset.subType === 'Spline') {
				object.subType = 'Spline';
				updateSpline(object.uuid);
			}
		});
		/*
    objects.forEach(object => {
      //start loop animation is any attached
      let animation = window.Q3.data.assets.objects[object.uuid].animation;
      if (animation) {
        if (typeof (animation) === "string") {
          window.Q3.data.assets.objects[object.uuid].animation = animation = {
            uuid: animation,
            type: THREE.LoopRepeat,
            timescale: 1
          }
        }

        const clip = window.Q3.assets.animations[animation.uuid];
        if (clip) {
          const action = window.Q3.mixer.clipAction(clip, object);
          action.setLoop(animation.type || THREE.LoopRepeat);
          action.setEffectiveTimeScale(animation.timescale || 1);
          action.play();
        }
      }
    });*/

		Object.keys(window.Q3.assets.lights).forEach(lightUuid => {
			//parenting
			const parentUuid = window.Q3.data.assets.lights[lightUuid].parent;
			(parentUuid ? window.Q3.assets.objects[parentUuid] : window.Q3.scene).add(
				window.Q3.assets.lights[lightUuid]
			);

			if (window.Q3.data.slides[0].animation[lightUuid]) {
				window.Q3.assets.lights[lightUuid].visible = !(
					window.Q3.data.slides[0].animation[lightUuid].visible === false
				);
			}

			if (window.Q3.data.assets.lights[lightUuid].targetUuid)
				window.Q3.assets.lights[lightUuid].target =
					window.Q3.assets.objects[window.Q3.data.assets.lights[lightUuid].targetUuid];
		});

		window.Q3.camera.needsUpdate = true;
		RenderManager.shadowMap.needsUpdate = true;

		const slide = window.Q3.data.slides[window.Q3.slide];
		window.Q3.background.setBackground(
			slide.backgroundType,
			slide.backgroundValue,
			slide.backgroundOffsetX,
			slide.backgroundOffsetY,
			slide.backgroundScaleX,
			slide.backgroundScaleY,
			0
		);
		if (!window.Q3.editMode) {
			window.Q3.container.parentElement.style.backgroundColor = slide.backgroundValue;
		}

		//window.Q3.splash.remove();

		//loadTextures();
	}

	function createEnvironmetLight() {
		var whiteImage = createImage('rgba(30,30,30,255)');

		const cube = new THREE.CubeTexture([
			whiteImage.image,
			whiteImage.image,
			whiteImage.image,
			whiteImage.image,
			whiteImage.image,
			whiteImage.image
		]);
		cube.encoding = THREE.RGBM16Encoding;
		whiteImage.promise.then(() => {
			cube.needsUpdate = true;
		});
		cube.generateMipmaps = false;
		cube.version = 1;
		window.Q3.assets.envLight = { cubeMap: cube };
	}

	function lensEffect(source, camera) {
		var flareColor = new THREE.Color(0xffffff);
		flareColor.setHSL(0.9, 0.9, 1);

		const lensFlareUpdateCallback = object => {
			var f,
				fl = object.lensFlares.length;
			var flare;
			var vecX = -object.positionScreen.x * 2;
			var vecY = -object.positionScreen.y * 2;

			for (f = 0; f < fl; f++) {
				flare = object.lensFlares[f];
				flare.x = object.positionScreen.x + vecX * flare.distance;
				flare.y = object.positionScreen.y + vecY * flare.distance;
				flare.rotation = 0;
			}

			object.lensFlares[2].y += 0.025;
			object.lensFlares[3].rotation = object.positionScreen.x * 0.5 + THREE.Math.degToRad(45);
		};

		const lensFlare = new THREE.LensFlare(
			window.Q3.assets.textures.lensflare1,
			1000,
			0.0,
			THREE.AdditiveBlending,
			flareColor
		);

		lensFlare.add(window.Q3.assets.textures.lensflare2, 2000, 0.0, THREE.AdditiveBlending);
		lensFlare.add(window.Q3.assets.textures.lensflare3, 100, 0.2, THREE.AdditiveBlending);
		lensFlare.add(window.Q3.assets.textures.lensflare3, 300, 0.3, THREE.AdditiveBlending);
		lensFlare.add(window.Q3.assets.textures.lensflare3, 70, 0.5, THREE.AdditiveBlending);
		lensFlare.add(window.Q3.assets.textures.lensflare3, 180, 0.9, THREE.AdditiveBlending);
		lensFlare.add(window.Q3.assets.textures.lensflare3, 70, 1.0, THREE.AdditiveBlending);

		lensFlare.customUpdateCallback = lensFlareUpdateCallback;

		return lensFlare;
	}
}

let assetsRequestsCount = 0;
let counter = 0;

function updateProgressBar() {
	window.Q3.splash.update(counter++ / assetsRequestsCount);
}

function loadGeometry() {
	const geometriesArray = Object.keys(window.Q3.data.assets.geometries);
	const promises = [];
	geometriesArray.forEach(g => {
		const gData = window.Q3.data.assets.geometries[g];

		let geo = null;
		debugger;
		switch (gData.type) {
			case 'Sphere':
				const sphereGeo = (geo = new THREE.SphereBufferGeometry(
					gData.radius,
					gData.widthSegments,
					gData.heightSegments
				));

				sphereGeo.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

				sphereGeo.uuid = g;
				sphereGeo.name = gData.name;

				window.Q3.assets.geometries[g] = sphereGeo;

				break;

			case 'Cube':
				const cubeGeo = (geo = new THREE.BoxBufferGeometry(gData.width, gData.height, gData.depth));

				cubeGeo.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

				cubeGeo.uuid = g;
				cubeGeo.name = gData.name;

				window.Q3.assets.geometries[g] = cubeGeo;

				break;

			case 'Arrow':
				const arrowGeo = (geo = new THREE.ArrowBufferGeometry(
					gData.width,
					gData.height,
					gData.depth,
					gData.arrowWidth,
					gData.arrowHeight
				));

				arrowGeo.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

				arrowGeo.uuid = g;
				arrowGeo.name = gData.name;

				window.Q3.assets.geometries[g] = arrowGeo;
				break;

			case 'Plane':
				const planeGeo = (geo = new THREE.PlaneBufferGeometry(
					gData.width,
					gData.height,
					gData.widthSegments,
					gData.heightSegments
				));
				planeGeo.uuid = g;
				planeGeo.name = gData.name;

				planeGeo.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

				window.Q3.assets.geometries[g] = planeGeo;
				break;

			case 'Ring':
				const ringGeo = (geo = new THREE.CustomRingBufferGeometry(
					gData.innerRadius,
					gData.outerRadius,
					gData.thetaSegments
				));

				ringGeo.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

				ringGeo.uuid = g;
				ringGeo.name = gData.name;

				window.Q3.assets.geometries[g] = ringGeo;
				break;

			case 'IconHotspot':
				const spriteGeo = (geo = generateSpriteGeometry());

				spriteGeo.uuid = g;
				spriteGeo.name = gData.name;

				window.Q3.assets.geometries[g] = spriteGeo;

				break;
			default:
				assetsRequestsCount++;
				promises.push(
					new Promise((resolve, reject) => {
						function loadDraco(path) {
							window.Q3.loaders.draco.load(
								path,
								geometry => {
									geo = geometry;

									updateProgressBar();

									geometry.addAttribute(
										'worldObjectId',
										new THREE.BufferAttribute(new Float32Array([]), 1)
									);

									window.Q3.assets.geometries[g] = geometry;
									window.Q3.assets.geometries[g].uuid = g;
									window.Q3.assets.geometries[g].name = gData.name;

									resolve();
								},
								undefined,
								reason => {
									updateProgressBar();

									window.Q3.assets.geometries[g] = undefined;

									// window.Q3.assets.geometries[g].uuid = g;
									// window.Q3.assets.geometries[g].name = gData.name;

									resolve();
								}
							);
						}

						function loadGeometryFromGLTF(path) {
							loadGLTF(
								path,
								nodes => {
									let geometry = null;
									let node = nodes.scene.getObjectByName(g);
									if (!!node) {
										geometry = node.geometry;
									} else {
										geometry = nodes.scene.children[0].geometry;
									}
									geo = geometry;

									updateProgressBar();

									geometry.addAttribute(
										'worldObjectId',
										new THREE.BufferAttribute(new Float32Array([]), 1)
									);

									window.Q3.assets.geometries[g] = geometry;
									window.Q3.assets.geometries[g].uuid = g;
									window.Q3.assets.geometries[g].name = gData.name;

									resolve();
								},
								reason => {
									updateProgressBar();

									window.Q3.assets.geometries[g] = undefined;

									// window.Q3.assets.geometries[g].uuid = g;
									// window.Q3.assets.geometries[g].name = gData.name;

									resolve();
								}
							);
						}

						gData.path.match(/.glb$|.gltf$/) ? loadGeometryFromGLTF(gData.path) : loadDraco(gData.path);
					})
				);

				break;
		}
	});
	return Promise.all(promises);
}

function loadAnimations() {
	const loadQueue = [];

	const animations = Object.keys(window.Q3.data.assets.animations || {});
	animations.forEach(animUuid => {
		loadQueue.push({
			priority: 2,
			load: () => {
				return new Promise(resolve => {
					const animData = window.Q3.data.assets.animations[animUuid];
					window.Q3.loaders.file.load(
						animData.path,
						animJson => {
							window.Q3.assets.animations = window.Q3.assets.animations || {};
							const clip = (window.Q3.assets.animations[animUuid] = THREE.AnimationClip.parse(
								JSON.parse(animJson)
							));
							const objectsUuids = Object.keys(window.Q3.data.assets.objects);
							objectsUuids.forEach(objectUuid => {
								//start loop animation is any attached
								let animation = window.Q3.data.assets.objects[objectUuid].animation;
								if (typeof animation === 'string') {
									window.Q3.data.assets.objects[objectUuid].animation = animation = {
										uuid: animation,
										type: THREE.LoopRepeat,
										timescale: 1
									};
								}

								if (animation && animation.uuid === animUuid) {
									const object = window.Q3.assets.objects[objectUuid];
									if (clip) {
										const action = window.Q3.mixer.clipAction(clip, object);
										action.setLoop(animation.type || THREE.LoopRepeat);
										action.setEffectiveTimeScale(animation.timescale || 1);
										action.play();
									}
								}
							});
							if (Object.keys(window.Q3.assets.animations).length === animations.length) {
								window.Q3.fire('assetsLoaded');
								console.log('assets loaded fired');
							}
							resolve();
						},
						undefined,
						resolve
					);
				});
			}
		});
	});
	return loadQueue;
}

function getTextureUrl(id, size) {
	const tData = window.Q3.data.assets.textures[id];
	const ext = tData.path.slice(tData.path.lastIndexOf('.') + 1);
	let url =
		'/texture?id=' + id + '&ext=' + ext + '&size=' + size + '&webp=' + window.Q3.browserCapabilities.supports.WebP;
	if (window.COOBO) {
		url = '/api' + url;
	}
	return url;
}

function loadTextures() {
	const texturesArray = Object.keys(window.Q3.data.assets.textures);
	window.Q3.loaders.texture = window.Q3.loaders.texture || new THREE.TextureLoader();
	const texturesLoadQueue = [];
	const materials = Object.keys(window.Q3.data.assets.materials).map(x => window.Q3.data.assets.materials[x]);
	const pbrTextures = materials
		.map(x => x.metalnessMap)
		.concat(materials.map(x => x.normalMap))
		.concat(materials.map(x => x.roughnessMap))
		.filter((item, pos, self) => self.indexOf(item) == pos);
	const backgroundTextures = window.Q3.data.slides.map(slide => slide.backgroundValue);

	texturesArray.forEach(t => {
		const tData = window.Q3.data.assets.textures[t];
		if (!tData.cube && window.Q3.assets.textures[t]) {
			//if texture placeholder was not created it means that we want to skip this texture (lq mode for instance)
			let size = window.Q3.data.assets.textures[t].size || 0; //assume size 2^12 = 4k if not present
			if (window.Q3.browserCapabilities.renderQuality === RenderQuality.NORMAL) {
				if (backgroundTextures.indexOf(t) === -1) {
					size--;
				}
			} else if (window.Q3.browserCapabilities.renderQuality === RenderQuality.LOW) {
				if (pbrTextures.indexOf(t) !== -1) {
					size -= 2;
				} else {
					size--;
				}
			}

			if (size <= 0 || size > 7) {
				const lodSize = 7; // texture size 2^7 = 128 as first LOD
				const lodPath = getTextureUrl(t, lodSize); // texture size 2^7 = 128 as first LOD
				texturesLoadQueue.push({
					priority: 0,
					load: loadTexture.bind(null, t, lodPath)
				});
			}

			const path = getTextureUrl(t, size);
			texturesLoadQueue.push({
				priority: 10,
				load: loadTexture.bind(null, t, path)
			});
		}
	});
	return texturesLoadQueue;
}

const textureRegex = /(?:[\da-z_-]+)\.(?:[a-z]+)$/i;

function loadTexture(uuid, path) {
	return new Promise(resolve => {
		if (!path) {
			resolve();
			return;
		}

		const match = path.match(textureRegex);

		path = match ? `/assets/${match[0]}${window.Q3.browserCapabilities.supports.WebP ? '.webp' : ''}` : path;

		window.Q3.loaders.texture.load(
			path,
			texture => {
				const tData = window.Q3.data.assets.textures[uuid];
				for (let k in tData) {
					if (texture.hasOwnProperty(k)) {
						if (k === 'repeat') {
							Object.assign(texture.repeat, { x: tData[k][0], y: tData[k][1] });
						} else {
							texture[k] = tData[k];
						}
					}
				}
				texture.uuid = uuid;
				if (!!window.Q3.assets.textures[uuid]) {
					window.Q3.assets.textures[uuid].dispose();
				}
				window.Q3.assets.textures[uuid] = texture;
				if (!tData.dominantColor) {
					RGBaster.colors(texture.image, {
						success: function(payload) {
							tData.dominantColor = payload.dominant;
						}
					});
				}
				updateObjects();
				window.Q3.background.updateTextures();
				resolve();
			},
			undefined,
			resolve
		);
	});
}

function loadLiveLabels() {
	let labelsLoaded = 0;
	const loadQueue = [];
	const liveLabels = Object.keys(window.Q3.data.liveLabels || {});
	if (!liveLabels.length) {
		window.Q3.fire('labelsLoaded');
		window.Q3.labelsLoaded = true;
	}

	function deserializeLabels(data) {
		if (!data) return;
		const { data: label_data, object } = data;
		if (object.uuid !== label_data.object_uuid) return;
		const label = label_data.label;
		window.Q3.labels.live.deserialize(label_data.version, object, label);
		//document.dispatchEvent(new Event("loadedassets"));
		labelsLoaded++;
		if (labelsLoaded === liveLabels.length) {
			window.Q3.labelsLoaded = true;
			window.Q3.fire('labelsLoaded');
		}
	}

	computeFontSize();

	if (!window.Q3.editMode && getParams(window.location.href).preview === 'true') {
		window.Q3.data.liveLabels.forEach(l => {
			const root = window.Q3.scene;
			const object = root.getObjectByProperty('uuid', l.object_uuid);
			deserializeLabels({ object: object, data: l });
		});
		window.Q3.fire('labelsLoaded');
	} else {
		liveLabels.forEach(object_uuid => {
			loadQueue.push({
				priority: 3,
				load: () => {
					return new Promise(resolve => {
						const root = window.Q3.scene;
						const object = root.getObjectByProperty('uuid', object_uuid);
						if (object) {
							const label_uuid = window.Q3.data.liveLabels[object_uuid];
							// var url = "/getLiveLabels/" + label_uuid;
							var url = `${window.location.origin}/assets/live-labels/${label_uuid}.json`;

							// This shouldn't be put here and is a placeholder to get the work done since I'm not familiar enough with the file flow.
							if (!window.COOBO) {
								url = '/assets/live-labels/' + label_uuid + '.json';
							}
							$.getJSON(url)
								.then(data => {
									deserializeLabels({ object: object, data: data });
									resolve(null);
								})
								.catch(() => resolve(null));
						} else resolve(null);
					});
				}
			});
		});
	}
	return loadQueue;
}

function loadEnvironmentLight() {
	function createImg(base64) {
		var image = new Image();
		let promise = new Promise((resolve, reject) => {
			image.onload = resolve;
		});
		image.src = base64;
		return { image: image, promise: promise };
	}

	const sides = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

	var url = window.Q3.data.slides[0].envLight || '/assets-qbix/F16EFB92-4B2C-46EB-8F86-8AC2322E4FAE.env'; //for old tours that do not hav it yet

	return {
		priority: 4,
		load: () => {
			return new Promise((resolve, reject) => {
				window.Q3.loadEnvLight(url).then(cubeData => {
					const envMap = window.Q3.assets.envLight.cubeMap;
					const loadPromises = [];
					for (let i = 0; i < cubeData.length; i++) {
						const mipmap = cubeData[i];
						envMap.mipmaps[i] = [];
						for (let side of sides) {
							let image = createImg(mipmap[side]);
							envMap.mipmaps[i].push(image.image);
							loadPromises.push(image.promise);
						}
					}
					Promise.all(loadPromises).then(() => {
						envMap.needsUpdate = true;
					});
					envMap.maxMipLevel = 5;
					resolve(null);
				});
			});
		}
	};
}

function updateObjects() {
	Object.keys(window.Q3.data.assets.materials).forEach(matUuid => {
		const matData = window.Q3.data.assets.materials[matUuid];

		if (matUuid) {
			const material = window.Q3.assets.materials[matUuid];

			Object.keys(matData).forEach(mapType => {
				if (
					(mapType.indexOf('map') > -1 || mapType.indexOf('Map') > -1) &&
					matData[mapType] &&
					mapType.indexOf('Intensity') === -1
				) {
					const texture = window.Q3.assets.textures[matData[mapType]];
					if (!texture) {
						console.warn(
							'Material ' + matData.name + ' uses texture which is not present in textures collection'
						);
						return;
					}

					if (mapType.indexOf('2') > -1) {
						//custom map uniforms for LOD
						material[mapType].value = window.Q3.assets.textures[matData[mapType]];
						material[mapType].value.needsUpdate = true;
					} else if (mapType === 'envMap') {
						material[mapType] = window.Q3.assets.envLight.cubeMap;
					} else {
						material[mapType] = window.Q3.assets.textures[matData[mapType]];
						material[mapType].needsUpdate = true;
					}
				}
			});

			if (material.isMeshNestedMaterial) {
				material.layers.forEach(layer => {
					if (layer.map) layer.map = window.Q3.assets.textures[layer.map.uuid];
					if (layer.normalMap) layer.normalMap = window.Q3.assets.textures[layer.normalMap.uuid];
				});
				material.resendTexturesToGPU();
			}

			material.needsUpdate = true;
			window.Q3.camera.update = true;
		}
	});
}

function initLoadQueue(backgroundLoadProgress) {
	var textures = loadTextures();
	var liveLabels = loadLiveLabels();
	var animations = loadAnimations();
	var envLight = loadEnvironmentLight();
	var all = [...textures, ...liveLabels, ...animations, envLight];
	var loaded = 0;
	all.sort((a, b) => a.priority - b.priority)
		.map(p => p.load)
		.reduce(
			(p, f) =>
				p.then(() => {
					loaded++;
					if (!!backgroundLoadProgress) {
						backgroundLoadProgress(loaded / all.length);
					}
					return f();
				}),
			Promise.resolve()
		);
}

// multiple geometries can be hold in a single gltf and each of them will try to load it
// this function will prevent from loading the same file multiple times
const gltfPromises = {};

function loadGLTF(path, onLoad, onError) {
	var promise = gltfPromises[path];
	if (!promise) {
		promise = new Promise(function(resolve, reject) {
			window.Q3.loaders.gltf.load(path, x => resolve(x), undefined, reject);
		});
		gltfPromises[path] = promise;
	}
	promise.then(onLoad, onError);
}

// WEBPACK FOOTER //
// ./src/Q3/assets/loadAssets.js
