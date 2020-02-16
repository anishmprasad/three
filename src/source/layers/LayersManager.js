/* eslint-disable no-unused-expressions */
import { Layer } from './Layer';
import { Text } from './../2DObjects/Text';
import RenderManager from '../rendering/render-manager';

export default class LayersManager {
	constructor(data) {
		this.container = document.createElement('div');
		this.container.id = 'slide-layers-container';
		this.container.style.background = window.Q3.data.slides[0].background || '#fff';
		this.container.style.position = 'relative';
		this.container.style.height = '100%';
		if (!window.Q3.editMode) {
			this.letterbox = window.Q3.letterbox;
		}

		this.attachedObjects = [];

		this.hoverDependentObjects = [];

		//to find layers by uuid as in data
		this.list = {};

		//The stack stores every layers,
		//even ones removed from the container (unvisible).
		//Purpose = keep track of indices and parenting
		this.graph = [];

		//output list without parenting and groups
		this.stack = [];

		//init
		this.list['Renderer'] = new Layer({
			name: data.layers.layer3D.name,
			index: 0,
			visible: data.slides[0].layers.Renderer,
			parent: data.layers.layer3D.parent,
			domElement: RenderManager.domElement,
			uuid: 'Renderer',
			type: 'Renderer'
		});

		let objFolders = [
			{
				name: 'texts',
				folderName: 'Texts'
			},
			{
				name: 'mathFormulas',
				folderName: 'Math Formulas'
			},
			{
				name: 'buttons',
				folderName: 'Buttons'
			},
			{
				name: 'sliders',
				folderName: 'Sliders'
			},
			{
				name: 'circleSliders',
				folderName: 'CircleSliders'
			},
			{
				name: 'lines',
				folderName: 'Lines'
			},
			{
				name: 'iframes',
				folderName: 'Iframes'
			},
			{
				name: 'pictures',
				folderName: 'Pictures'
			},
			{
				name: 'liveLabels',
				folderName: 'LiveLabels'
			}
		];

		objFolders.forEach(f => {
			this[f.name] = new Layer({
				name: f.folderName,
				type: '2DGroup',
				visible: true
			});
			this.list[this[f.name].uuid] = this[f.name];
			this[f.name].isRootFolder = true;
			window.Q3.data.slides.forEach(s => {
				s.layers[this[f.name].uuid] = true;
			});
		});

		let layers2d = {};
		for (let uuid in window.Q3.data.layers.layers2D) {
			if (window.Q3.data.slides[0].layers2D[uuid] || window.Q3.data.layers.layers2D[uuid].generalVisibility) {
				layers2d[uuid] = window.Q3.data.layers.layers2D[uuid];
			}
		}
		this.addLayers(layers2d);

		this.updateGraph();

		this.updateStack();

		this.updateLayersRender();

		window.Q3.container.appendChild(this.container);

		return this;
	}

	addLayers(data) {
		for (let uuid in data) {
			const layerData = data[uuid];
			if (!layerData.objects) {
				console.warn('Found Layer 2D with "objects" property not set, it will be removed');
				layerData.objects = {};
			}

			const key = Object.keys(layerData.objects)[0];
			if (!key) {
				delete data[uuid];
				continue;
			}
			if (layerData.objects[key].type === 'iframe') {
				layerData.subtype = 'iframes';
			}
			this.list[uuid] = new Layer({
				type: layerData.type,
				isText: layerData.objects[key].type === 'text' || layerData.objects[key].type === 'mathFormula',
				uuid: uuid,
				name: layerData.name,
				// index: index,
				visible: true,
				generalVisibility: layerData.generalVisibility,
				parent: layerData.parent,
				objects: layerData.objects,
				subtype: layerData.subtype
			});
			if (layerData.templateId && layerData.templateUuid) {
				this.list[uuid].templateId = layerData.templateId;
				this.list[uuid].templateUuid = layerData.templateUuid;
			}
			this.list[uuid].level = 1;
			if (layerData.objects[key].type === 'text') {
				this.list[uuid].parent = this.texts.uuid;
			}

			if (layerData.objects[key].type === 'mathFormula') {
				this.list[uuid].parent = this.mathFormulas.uuid;
			}

			if (layerData.objects[key].type === 'button') {
				this.list[uuid].parent = this.buttons.uuid;
			}
			if (layerData.objects[key].type === 'slider') {
				this.list[uuid].parent = this.sliders.uuid;
			}
			if (layerData.objects[key].type === 'circleSlider') {
				this.list[uuid].parent = this.circleSliders.uuid;
			}
			if (layerData.objects[key].type === 'line') {
				this.list[uuid].parent = this.lines.uuid;
			}
			if (layerData.objects[key].type === 'picture') {
				this.list[uuid].parent = this.pictures.uuid;
			}
			if (layerData.objects[key].type === 'iframe') {
				this.list[uuid].parent = this.iframes.uuid;
			}
		}
	}

	update(slide, byScroll) {
		this.updateGraph();
		this.updateStack();
		this.updateLayersRender(slide, byScroll);
	}

	updateChildrenIndices(childrenArray) {
		// let i = 0;
		// childrenArray.forEach( (c) => {
		//   c.index = i;
		//   c.uuid === 'Renderer' ?
		//     window.Q3.data.layers.layer3D.index = i
		//     : window.Q3.data.layers.layers2D[c.uuid].index = i;
		//   i++;
		// })
	}

	updateGraph() {
		//reset graph
		this.graph = [];

		//reset parenting
		// for (let layer in this.list)

		let generalVisibility = [];

		this.texts.children &&
			this.texts.children.forEach(t => {
				t.generalVisibility && window.Q3.data.layers.layers2D[t.uuid] && generalVisibility.push(t);
			});

		Object.keys(this.list).forEach(uuid => {
			//reset parenting
			if (this.list[uuid].children) {
				this.list[uuid].children = [];
			}

			//check current visibilities
			this.list[uuid].visible = window.Q3.data.slides[window.Q3.slide].layers[uuid];
		});

		this.texts.children = generalVisibility;

		//create new graph
		Object.keys(this.list).forEach(uuid => {
			const layer = this.list[uuid];

			if (layer.parent) {
				const parentPlayer = this.list[layer.parent];
				if (parentPlayer) {
					parentPlayer.add(layer);
					layer.isVisible = parentPlayer.isVisible;
				}
			} else this.graph[this.graph.length] = layer;
		});
	}

	updateStack() {
		this.stack = [];

		//update levels + build stack
		const traverseLevels = (a, level = 0) => {
			for (let i = 0; i < a.length; i++) {
				if (!a[i]) continue;
				a[i].level = level;
				if (!a[i].visible) continue;
				if (a[i].type === '2DGroup') traverseLevels(a[i].children, level + 1);
				else {
					if (this.stack.indexOf(a[i]) === -1) this.stack.push(a[i]);
				}
			}
		};

		traverseLevels(this.graph);
	}

	updateLayersRender(slide, byScroll) {
		if (slide && slide === window.Q3.slide) {
			while (this.container.lastChild) this.container.removeChild(this.container.lastChild);
			if (this.letterbox) {
				this.letterbox.innerHTML = '';
			}
			this.stack.forEach(layer => {
				this.container.appendChild(layer.domElement);
			});
		} else {
			let layersToKeep = [];
			//browser DOM rendering efficiency here ?

			this.stack.forEach(layer => {
				if (layer.objects && layer.objects[0] instanceof Text) {
					// if (window.Q3.slide !== 0 && window.Q3.data.slides[window.Q3.prevSlide] && window.Q3.data.slides[window.Q3.prevSlide].layers[layer.uuid]) { layersToKeep.push(layer.domElement.id); }
					if (layer.generalVisibility) {
						layersToKeep.push(layer.domElement.id);
					}
				}
			});

			[...['container'], ...(this.letterbox ? ['letterbox'] : [])].forEach(cnt => {
				const children = this[cnt].children;
				const childrenArray = Array.prototype.slice.call(children);

				childrenArray.forEach(child => {
					if (child.id !== '' && layersToKeep.indexOf(child.id) > -1);
					else if (!child.classList.contains('has-leaving-animation')) this[cnt].removeChild(child);
				});
			});

			this.stack.forEach(layer => {
				if (layer.objects && layer.objects[0] instanceof Text && !window.Q3.editMode) {
					if (
						window.Q3.slide !== 0 &&
						window.Q3.data.slides[window.Q3.prevSlide] &&
						window.Q3.data.slides[window.Q3.prevSlide].layers[layer.uuid]
					) {
					} else {
						let targetCnt = this[layer.objects[0].targetUuid ? 'container' : 'letterbox'];
						!targetCnt.contains(layer.domElement) && targetCnt.appendChild(layer.domElement);
					}

					window.Q3.scrollPositions = window.Q3.scrollPositions || [];

					let el = layer.objects[0].domElement.children[0].children[0];

					if (!window.Q3.scrollPositions[layer.objects[0].uuid] && !layer.generalVisibility) {
						setScrollPositions(el, layer.objects[0].startSlide, layer.objects[0].uuid);
					}

					const scrollPositions = window.Q3.scrollPositions[layer.objects[0].uuid];
					if (scrollPositions) {
						const scrollTop = window.Q3.scrollPositions[layer.objects[0].uuid][window.Q3.slide];

						scrollTop !== -1 && !byScroll ? (el.scrollTop = scrollTop) : null;
					}
				} else if (
					layer.objects &&
					(layer.objects[0] instanceof window.Q3.Picture ||
						layer.objects[0] instanceof window.Q3.Button ||
						layer.objects[0] instanceof window.Q3.Iframe) &&
					!window.Q3.editMode
				) {
					this.letterbox.appendChild(layer.domElement);
				} else {
					this.container.appendChild(layer.domElement);
				}
			});
		}

		//browser DOM rendering efficiency here ?

		/*  while ( this.container.lastChild ) this.container.removeChild( this.container.lastChild );
      this.stack.forEach( layer => { this.container.appendChild( layer.domElement ) } );*/
	}

	render() {
		let w = RenderManager.domElement.width;
		let h = RenderManager.domElement.height - 55;

		// if (w<=768 && !window.Q3.editMode) {
		//   h = h - 50;
		// }

		this.graph.forEach(layer => layer.render(w / window.devicePixelRatio, h / window.devicePixelRatio));

		this.occludeObjects();
	}

	occludeObjects() {
		//todo :
		//before checking what object occludes what other object
		//check if objects are occluded by other stuff
		//which means first cpu calculcation of distance and comparing to depthbbuffer.

		if (!window.Q3.depthPass || window.Q3.noFragDepth || window.Q3.noDepthTex) return;

		//1. get camera distance and depth value
		this.attachedObjects.forEach(object => {
			if (object instanceof window.Q3.Text) {
				const x = parseInt(object.domElement.getAttribute('x')),
					y = parseInt(object.domElement.getAttribute('y')),
					width = parseInt(object.textElement.style.width),
					height = parseInt(object.textElement.style.height),
					cx = x + width / 2,
					cy = y + height / 2;

				//Units = far-near distance
				//1. depth value at the position of the target ( to check object occlusion)
				object.depthValue = window.Q3.depthPass.getDepthRatio(cx, cy);

				//2. camera distance of the target
				object.camDist =
					(object.target.position
						.clone()
						.sub(window.Q3.camera.position)
						.length() -
						window.Q3.camera.near) /
					(window.Q3.camera.far - window.Q3.camera.near);
			} else if (object instanceof window.Q3.Picture) {
				const x = parseInt(object.domElement.getAttribute('x')),
					y = parseInt(object.domElement.getAttribute('y')),
					width = parseInt(object.pictureElement.style.width),
					height = parseInt(object.pictureElement.style.height) || 0.5,
					cx = x + width / 2,
					cy = y + height / 2;

				//Units = far-near distance
				//1. depth value at the position of the target ( to check object occlusion)
				object.depthValue = window.Q3.depthPass.getDepthRatio(cx, cy);

				//2. camera distance of the target
				object.camDist =
					(object.target.position
						.clone()
						.sub(window.Q3.camera.position)
						.length() -
						window.Q3.camera.near) /
					(window.Q3.camera.far - window.Q3.camera.near);
			}
		});

		//2. sort on camera distance
		this.attachedObjects.sort((a, b) => {
			return a.camDist < b.camDist ? -1 : a.camDist > b.camDist ? 1 : 0;
		});

		//3. object occlusion
		const visibleObjects = [];

		this.attachedObjects.forEach(object => {
			if (!object.depthOccluded) {
				object.show();
				visibleObjects.push(object);
				return;
			}

			if (object.depthValue < object.camDist) {
				object.hide();
			} else {
				object.show();
				visibleObjects.push(object);
			}
		});

		//4. occlude by checking previous objects
		visibleObjects.forEach((object, i) => {
			if (i === 0) return object.show();

			if (!object.elementsOccluded) return object.show();

			for (let j = 0; j < i; j++) {
				if (areColliding(this.attachedObjects[j], object)) {
					return object.hide();
				}
			}

			object.show();
		});
	}
}

function areColliding(objectA, objectB) {
	const xA = parseInt(objectA.domElement.getAttribute('x')),
		yA = parseInt(objectA.domElement.getAttribute('y')),
		widthA = parseInt(objectA.textElement.style.width),
		heightA = parseInt(objectA.textElement.style.height),
		xB = parseInt(objectB.domElement.getAttribute('x')),
		yB = parseInt(objectB.domElement.getAttribute('y')),
		widthB = parseInt(objectB.textElement.style.width),
		heightB = parseInt(objectB.textElement.style.height);

	let areCollidingHorizontally = false,
		areCollidingVertically = false;

	//horizontal checks
	if (xA > xB) areCollidingHorizontally = xB + widthB > xA;
	else if (xA < xB) areCollidingHorizontally = xA + widthA > xB;

	//vertical checks
	if (yA > yB) areCollidingVertically = yB + heightB > yA;
	else if (yA < yB) areCollidingVertically = yA + heightA > yB;

	return areCollidingHorizontally && areCollidingVertically;
}

function setScrollPositions(el, startSlide, uuid) {
	let scrollPositions = [];
	for (let i in window.Q3.data.slides) {
		scrollPositions[i] = -1;
	}

	scrollPositions[startSlide] = 0;

	const textElementTop = el.getBoundingClientRect().top;

	el.innerHTML += '<hr class="horizontal-marker viewer"></hr>';
	const markers = $(el).find('.horizontal-marker');
	let slide = startSlide + 1;
	let shouldSet = true;
	if (markers.length > 1) {
		for (var i = 0; i < markers.length; i++) {
			//this.options.scrollPositions[$(markers[i]).attr('data-slide')] = Math.round(markers[i].getBoundingClientRect().top - textElementTop);
			console.log(markers[i].getBoundingClientRect().top);
			if (markers[i].getBoundingClientRect().top === 0) shouldSet = false;
			scrollPositions[slide++] = Math.round(markers[i].getBoundingClientRect().top - textElementTop);
		}
	}
	window.Q3.scrollPositions = window.Q3.scrollPositions || [];
	if (shouldSet) window.Q3.scrollPositions[uuid] = scrollPositions;
}

// WEBPACK FOOTER //
// ./src/Q3/layers/LayersManager.js
