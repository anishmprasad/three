//import THREE from "three";
import loadGeometry from './deserialize-geometry';
import loadTexture, { isTextureInUse, enqueueTextures } from './deserialize-texture';
import loadLight, { loadEnvLight, finalizeLight, enqueEnvironmentLight } from './asset-lights';
import loadMaterial, { isMaterialInUse } from './deserialize-material';
import loadObject, { finalizeObject, bindSkeleton } from './deserialize-object';
import { RenderManager } from '../rendering/render-manager';
import { enqueLivelabels } from './deserialize-livelabels';
import { enqueAnimations, populateAnimationData } from './deserialize-animations';
import Layer from '../layers/Layer';
import { addAnimation } from '../slides/animation/addAnimation';

const loaders = Object.freeze({
	texture: new THREE.TextureLoader(),
	HDRCube: new THREE.HDRCubeTextureLoader(),
	draco: new THREE.DRACOLoader(),
	GLTF: new THREE.GLTFLoader(),
	file: new THREE.FileLoader()
});

class CAssetDeserializer {
	constructor() {}

	_loadGeometries({ data }) {
		return Promise.all(Object.keys(data).map(key => loadGeometry({ uuid: key, data: data[key], loaders })));
	}

	_loadTextures({ data }) {
		const newTextures = {};
		const promises = Promise.all(
			Object.keys(data.assets.textures)
				.filter(key => isTextureInUse({ uuid: key, data }))
				.map(key => {
					newTextures[key] = data.assets.textures[key];

					return loadTexture({
						uuid: key,
						data: data.assets.textures[key],
						materials: data.assets.materials,
						slides: data.slides
					});
				})
		);

		data.assets.textures = newTextures;

		return promises;
	}

	_loadLights({ data, browserCapabilities }) {
		// const newLights = {};

		return Promise.all(
			Object.keys(data).map(key => {
				const light = loadLight({
					uuid: key,
					data: data[key],
					browserCapabilities
				});

				// newLights[key] = data[key];

				return light;
			})
		);
	}

	_loadEnvLights() {
		return new Promise(resolve => {
			loadEnvLight().then(light => {
				resolve({ uuid: light.uuid, light });
			});
		});
	}

	_loadMaterials({ data, textures, envMap }) {
		const newMaterials = {};

		const promises = Promise.all(
			Object.keys(data.assets.materials)
				.filter(key => isMaterialInUse({ uuid: key, data }))
				.map(key => {
					const material = loadMaterial({
						uuid: key,
						data: data.assets.materials[key],
						textures,
						envMap
					});

					newMaterials[key] = data.assets.materials[key];

					return material;
				})
		);

		data.assets.materials = newMaterials;

		return promises;
	}

	_loadObjects({ data, geometries, materials, slides = [] }) {
		return Promise.all(
			Object.keys(data).map(key =>
				loadObject({
					uuid: key,
					data: data[key],
					geometries,
					materials,
					visible: slides[0]
						? slides[0].animation[key]
							? slides[0].animation[key].visible !== false
							: true
						: true
				})
			)
		).then(objects => {
			objects.forEach(({ uuid, object }) =>
				finalizeObject({
					object,
					slides,
					objects,
					uuid,
					data,
					materials
				})
			);

			return objects;
		});
	}

	_addLights({ lights, objects, data, slides }) {
		Object.keys(lights).forEach(uuid => {
			finalizeLight({ uuid, light: lights[uuid], objects, data, slides });
		});
	}

	_bindSkeletons({ data, objects }) {
		Object.keys(objects).forEach(uuid => {
			bindSkeleton({ uuid, data, object: objects[uuid], objects });
		});
	}

	_enqueAssets({ data, queue, isAsset }) {
		enqueueTextures({ data: data.assets, queue: queue.textures, queuePriority: queue.highPriority, isAsset });
		enqueEnvironmentLight({ data, queue: queue.envlight, isAsset });
		enqueAnimations({ data: data.assets, queue: queue.animations });
		enqueLivelabels({ data, queue: queue.livelabels });
	}

	_loadQueue({ queue, assets, data, background, mixer, editMode, scene, livelabelManager, highPriorityCallback }) {
		let hasCalledPriority = false;

		return new Promise(resolve => {
			queue.sort();

			const all = [];
			let waitingForLast = false;
			(function loadNextItems(count) {
				const items = queue.getItems(count);

				if (!hasCalledPriority && queue.highPriority.isEmpty()) {
					if (highPriorityCallback) highPriorityCallback();
					hasCalledPriority = false;
				}

				if (items.length > 0) {
					for (const item of items) {
						all.push(
							item
								.load({
									loaders,
									assets,
									data,
									item: item.data,
									background,
									mixer,
									editMode,
									scene,
									livelabelManager
								})
								// .then(data => console.log("replace i guess"))
								.catch(reason => console.error(reason))
								.finally(() => {
									if (!waitingForLast) loadNextItems(1);
								})
						);
					}
				} else if (!waitingForLast) {
					waitingForLast = true;
					console.log('No more items');
					Promise.all(all).then(() => {
						console.log('all is loaded');
						resolve();
					});
				}
			})(5);
		});
	}

	importAsset({ data, assets, browserCapabilities, activeData, slide, layers }) {
		const { assetId, assetData } = data;

		activeData.assets.references.push(assetId);

		Object.keys(assetData.assets).forEach(key => {
			const assetType = assetData.assets[key];
			const isObject = key === 'objects';

			Object.keys(assetType).forEach(key => {
				assetType[key].isReference = true;

				if (isObject) assetType[key].parent_world = window.Q3.gateNetwork.currentWorldUuid;
			});
		});

		const assetQueue = new AssetQueue();
		const nextSlide = slide + 1;
		const slideData = JSON.parse(JSON.stringify(activeData.slides[slide]));

		activeData.slides.splice(nextSlide, 0, slideData);

		addAnimation();

		const new2DAssets = Object.keys(window.Q3.data.layers.layers2D).reduce((accum, uuid) => {
			if (uuid !== undefined) {
				accum[uuid] = true;
				layers.list[uuid] = new Layer(activeData.layers.layers2D[uuid]);
				layers.list[uuid].uuid = uuid;
			}

			return accum;
		}, {});

		layers.update();
		activeData.slides[slide].layers = Object.assign({}, activeData.slides[slide].layers, new2DAssets);

		return new Promise(resolve => {
			this._loadGeometries({ data: assetData.assets.geometries }).then(_geometries => {
				const geometries = reduceArray(_geometries, 'geometry');

				merge(assets.geometries, geometries);
				merge(activeData.assets.geometries, assetData.assets.geometries);

				console.log('Geometry ready.');

				this._loadTextures({ data: assetData }).then(_textures => {
					const textures = reduceArray(_textures, 'texture');

					merge(assets.textures, textures);
					merge(activeData.assets.textures, assetData.assets.textures);

					console.log('Textures ready.');

					this._loadLights({ data: assetData.assets.lights, browserCapabilities }).then(_lights => {
						const lights = reduceArray(_lights, 'light');

						merge(assets.lights, lights);
						merge(activeData.assets.lights, assetData.assets.lights);

						console.log('Lights ready.');

						const envMap = assets.envLight;

						this._loadMaterials({ data: assetData, textures, envMap: envMap.cubeMap }).then(_materials => {
							const materials = reduceArray(_materials, 'material');

							merge(assets.materials, materials);
							merge(activeData.assets.materials, assetData.assets.materials);

							console.log('Materials ready.');

							this._loadObjects({
								data: assetData.assets.objects,
								geometries,
								materials,
								slides: assetData.slides
							}).then(_objects => {
								const objects = reduceArray(_objects, 'object');

								merge(assets.objects, objects);
								merge(activeData.assets.objects, assetData.assets.objects);

								populateAnimationData({ data: activeData, additionalData: assetData });

								Object.keys(assetData.assets.objects).forEach(key => {
									activeData.slides[slide].animation[key].visible = true;
								});

								console.log('Objects ready.');

								this._addLights({ lights, objects, data: assetData, slides: activeData.slides });

								this._bindSkeletons({ data: assetData, objects });

								this._enqueAssets({ data: assetData, queue: assetQueue, isAsset: true });

								this._loadQueue({
									queue: assetQueue,
									assets,
									data: assetData,
									background: window.Q3.background,
									mixer: window.Q3.mixer,
									scene: window.Q3.scene,
									editMode: window.Q3.editMode,
									livelabelManager: window.Q3.labels.live
								}).then(() => {
									resolve(1);
									window.Q3.fire('assetsLoaded');
								});
							});
						});
					});
				});
			});
		});
	}

	_loadReferences({ data }) {
		// loaders.file.setRequestHeader({
		//     Authorization: `Bearer ${localStorage.getItem("jwt")}`
		// });

		const existingReferences = Object.keys(data.assets).reduce((accum, key) => {
			const assetType = data.assets[key];

			if (key === 'references') return accum;

			accum[key] = Object.keys(assetType).reduce((accum, key) => {
				if (assetType[key].isReference) {
					accum[key] = assetType[key];
					delete assetType[key];
				}

				return accum;
			}, {});

			return accum;
		}, {});

		// console.log(existingReferences);

		return Promise.all(
			data.assets.references.map(ref => {
				return new Promise((resolve, reject) => {
					const url = `${window.location.origin}${window.COOBO ? '/api' : ''}/assetlib/${ref}`;

					function success(asset) {
						asset = JSON.parse(asset);

						Object.keys(asset.data.assets).forEach(key => {
							const assetType = asset.data.assets[key];
							Object.keys(assetType).forEach(key => {
								assetType[key].isReference = true;
							});
						});

						data.liveLabels = Object.assign({}, asset.data.liveLabels, data.liveLabels);

						Object.keys(asset.data.assets).forEach(key => {
							const assetTypeLib = asset.data.assets[key];
							const assetTypeRef = existingReferences[key] || {};
							const assetType = (data.assets[key] = data.assets[key] || {});
							const isObject = key === 'objects';
							const isMaterial = key === 'materials';

							Object.keys(assetTypeLib).forEach(key => {
								if (isMaterial)
									assetType[key] = Object.assign({}, assetTypeLib[key], assetTypeRef[key]);
								else assetType[key] = assetTypeLib[key];

								if (assetTypeRef[key]) {
									const refAsset = assetTypeRef[key];
									const ref = assetType[key];
									Object.keys(refAsset).forEach(key => {
										if (isObject && key === 'parent_world') {
											ref[key] = refAsset[key];
										}
										// if (key === "position") {
										//     console.log("update position")
										// } else if (key === "rotation") {
										//     console.log("update rotation");
										// } else if (key === "scale") {
										//     console.log("update scale");
										// } else if (key === "quaternion") {
										//     console.log("update quaternion");
										// } else {
										//     ref[key] = refAsset[key];
										// }
									});
								}

								if (isObject) {
									const object = assetTypeLib[key];
									data.slides.forEach(slide => {
										if (!slide.animation[key]) {
											slide.animation[key] = {
												position: {
													x: object.position.x,
													y: object.position.y,
													z: object.position.z
												},
												rotation: {
													x: object.rotation.x,
													y: object.rotation.y,
													z: object.rotation.z
												},
												scale: { x: object.scale.x, y: object.scale.y, z: object.scale.z }
											};
										}
									});
								}
							});
						});

						// data.assets = Object.keys(data.assets).map(key => {
						//     const sourceAssetType = data.assets[assetType];
						//     const referenceAssetType = asset.data.assets[assetType];
						// });

						resolve();
					}

					loaders.file.load(url, success, undefined, reject);
				});
			})
		).then(loaders.file.setRequestHeader(undefined));
	}

	load({ data, browserCapabilities, curSlide, isEditMode, backgroundContainer }) {
		console.log(data);

		const assets = new AssetLibrary();
		const assetQueue = new AssetQueue();

		window.Q3.assets = assets;

		data.assets.references = data.assets.references || [];

		return new Promise(resolve => {
			this._loadReferences({ data }).then(() => {
				this._loadGeometries({ data: data.assets.geometries }).then(_geometries => {
					const geometries = reduceArray(_geometries, 'geometry');

					assets.geometries = geometries;

					console.log('Geometry ready.');

					this._loadTextures({ data }).then(_textures => {
						const textures = reduceArray(_textures, 'texture');

						assets.textures = textures;

						console.log('Textures ready.');

						this._loadLights({ data: data.assets.lights, browserCapabilities }).then(_lights => {
							const lights = reduceArray(_lights, 'light');

							assets.lights = lights;

							console.log('Lights ready.');

							this._loadEnvLights().then(_envLight => {
								const envMap = { cubeMap: _envLight.light };

								assets.envLight = envMap;

								console.log('Environment light ready.');

								this._loadMaterials({ data, textures, envMap: envMap.cubeMap }).then(_materials => {
									const materials = reduceArray(_materials, 'material');

									assets.materials = materials;

									console.log('Materials ready.');

									this._loadObjects({
										data: data.assets.objects,
										geometries,
										materials,
										slides: data.slides
									}).then(_objects => {
										const objects = reduceArray(_objects, 'object');

										assets.objects = objects;

										console.log('Objects ready.');

										this._addLights({ lights, objects, data, slides: data.slides });

										this._bindSkeletons({ data, objects });

										resolve(1);
									});
								});
							});
						});
					});
				});
			});
		}).then(result => {
			RenderManager.shadowMap.needsUpdate = true;
			const slide = data.slides[curSlide];

			if (!isEditMode) {
				backgroundContainer.parentElement.style.backgroundColor = slide.backgroundValue;
			}

			window.Q3.fire('assetsLoaded');
			window.Q3.fire('labelsLoaded');
			window.Q3.allIsLoaded = true;
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

			console.log('Everything is ready.');

			this._enqueAssets({ data, queue: assetQueue });

			const highPriorityCallback = () => {
				window.Q3.background.setBackground(
					slide.backgroundType,
					slide.backgroundValue,
					slide.backgroundOffsetX,
					slide.backgroundOffsetY,
					slide.backgroundScaleX,
					slide.backgroundScaleY,
					0
				);
			};

			this._loadQueue({
				queue: assetQueue,
				assets,
				data,
				background: window.Q3.background,
				mixer: window.Q3.mixer,
				scene: window.Q3.scene,
				editMode: window.Q3.editMode,
				livelabelManager: window.Q3.labels.live,
				highPriorityCallback
			}).then(() => {
				window.Q3.fire('assetsLoaded');
			});

			// console.log(assetQueue);

			return result;
		});
	}
}

const AssetDeserializer = new CAssetDeserializer();

export default AssetDeserializer;
export { AssetDeserializer };

class AssetLibrary {
	constructor() {
		this.textures = {};
		this.geometries = {};
		this.lights = {};
		this.materials = {};
		this.objects = {};
		this.animations = {};
		this.envLight = { cubeMap: null };
		this.references = [];
	}
}

class AssetQueue {
	constructor() {
		this.textures = new Queue();
		this.highPriority = new Queue(true);
		this.livelabels = new Queue();
		this.envlight = new Queue();
		this.animations = new Queue();

		Object.freeze(this);
	}

	sort() {
		Object.keys(this).forEach(q => {
			if (this[q] instanceof Queue) this[q].sort();
		});
	}

	getItems(count) {
		const result = [];
		for (let i = 0; i < count; i++) {
			let item = this.getItem();
			if (!!item) {
				result.push(item);
			} else {
				return result;
			}
		}
		return result;
	}

	getItem() {
		const queue = Object.keys(this)
			.map(key => this[key])
			.reduce(
				(prev, curr) => {
					if (!(curr instanceof Queue) || curr.queue.length === 0) {
						return prev;
					}
					if (!prev.queue || prev.queue.length === 0) {
						return curr;
					}
					return prev.queue[0].priority < curr.queue[0].priority ? prev : curr;
				},
				{
					queue: []
					//priority: Infinity
				}
			);

		return (queue && queue.queue.shift()) || null;
	}
}

class Queue {
	constructor(isHighPriority = false) {
		/**
		 * @type {QueueItem[]}
		 */
		this.queue = [];

		this.isHighPriority = isHighPriority;

		Object.freeze(this);
	}

	isEmpty() {
		return this.queue.length === 0;
	}

	addItem(priority, data, loaders) {
		this.queue.push(new QueueItem(priority, data, loaders));
	}

	sort() {
		this.queue.sort((a, b) => a.priority - b.priority);
	}
}

class QueueItem {
	/**
	 * @param {number} priority
	 * @param {Object} data
	 */
	constructor(priority, data = {}, load) {
		this.priority = priority;
		this.data = data;
		this.load = load;

		Object.freeze(this);
	}
}

function merge(original, additional) {
	Object.keys(additional).forEach(key => {
		original[key] = additional[key];
	});
}

function reduceArray(data, key) {
	return data.reduce((accum, params) => {
		accum[params.uuid] = params[key];

		return accum;
	}, {});
}

// WEBPACK FOOTER //
// ./src/Q3/assets/asset-deserializer.js
