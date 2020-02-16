import { Line } from './../2DObjects/Line.js';
import Text from './../2DObjects/Text.js';
import Button from './../2DObjects/Button.js';
import Picture from './../2DObjects/Picture.js';
import Iframe from './../2DObjects/Iframe.js';
import Slider from './../2DObjects/Slider.js';
import CircleSlider from './../2DObjects/CircleSlider.js';
import MathFormula from './../2DObjects/MathFormula.js';
import RenderManager from '../rendering/render-manager';

const NSString = 'http://www.w3.org/2000/svg';

class Layer {
	constructor(options = {}) {
		this.type = options.type || '2D';
		this.subtype = options.subtype;

		this.name = options.name || '';

		this.isText = options.isText || false;

		this.level = 0;

		// this.index = options.hasOwnProperty('index') ? options.index : 0;

		this.uuid = options.uuid || THREE.Math.generateUUID();

		this.visible = options.visible !== false;
		this.isVisible = true;
		this.generalVisibility = options.generalVisibility;

		this.parent = options.parent;

		this.styles = {
			position: 'absolute',
			left: '0',
			top: '0',
			width: '100%',
			height: 'calc(100% - 55px)',
			overflow: 'hidden',
			pointerEvents: 'none',
			zIndex: 4
		};

		// if ( this.type === '2D' && this.isText) {
		//   this.domElement = document.createElement('div');
		//   this.domElement.id = this.name;
		//   Object.assign( this.domElement.style,  this.styles );
		//   this.objects = this.initObjects( options.objects );
		// } else

		if (this.type === '2D') {
			window.Q3.data.slides[window.Q3.slide].layers2D[this.uuid] = 1;
			// if (window.Q3.data.slides[window.Q3.slide].layers2D.indexOf(this.uuid) === -1) {
			//     window.Q3.data.slides[window.Q3.slide].layers2D.push(this.uuid);
			// }

			if (this.subtype === 'sliders' || this.subtype === 'iframes' || this.isText) {
				//jquery ui slider is not working inside svg->foreignObject (problem with calculation of thumb position)
				//svg is not needed in this case div is enough
				this.domElement = document.createElement('div');
				// this.domElement.setAttribute('width', "100%");
				// this.domElement.setAttribute('height', "100%");
				this.domElement.id = this.uuid;
			} else {
				this.domElement = document.createElementNS(NSString, 'svg');
				this.domElement.setAttribute('width', 400);
				this.domElement.setAttribute('height', 300);
				this.domElement.id = this.uuid;

				//required for lines arrows at least
				this.defs = document.createElementNS(NSString, 'defs');
				this.domElement.appendChild(this.defs);
			}

			Object.assign(this.domElement.style, this.styles);

			this.objects = this.initObjects(options.objects);
		} else if (this.type === '2DGroup') {
			this.children = [];
		} else if (this.type === 'Renderer') {
			this.domElement = options.domElement;

			Object.assign(this.domElement.style, {
				position: 'absolute',
				left: '0',
				top: '0',
				pointerEvents: 'none'
			});
		}

		return this;
	}

	add(child) {
		(this.type === '2D' ? this.objects : this.children).push(child);

		child.parent = this.uuid;

		return this;
	}

	clone() {
		const uuid = THREE.Math.generateUUID(),
			objectsWithNewUuids = {},
			objectsWithCurrentUuids = JSON.parse(JSON.stringify(window.Q3.data.layers.layers2D[this.uuid].objects)); //deep cloning object

		for (let currentUuid in objectsWithCurrentUuids)
			objectsWithNewUuids[THREE.Math.generateUUID()] = objectsWithCurrentUuids[currentUuid];

		const l = new Layer({
			uuid: uuid,
			name: this.name + '(copy)',
			type: this.type,
			subtype: this.subtype,
			isText: this.isText,
			parent: this.parent,
			children: this.children,
			objects: objectsWithNewUuids,
			visible: this.visible
		});

		window.Q3.data.layers.layers2D[l.uuid] = {
			name: l.name,
			type: l.type,
			subtype: l.subtype,
			isText: l.isText,
			// parent: l.parent,
			children: l.children,
			objects: objectsWithNewUuids,
			visible: l.visible
		};

		const brothers = this.parent ? window.Q3.layers.list[this.parent].children : window.Q3.layers.graph;

		brothers.splice(this.index, 0, l);

		return l;
	}

	remove(child) {
		const a = this.type === '2D' ? this.objects : this.children;

		a.splice(a.indexOf(child), 1);

		//update indices of next children
		// for (let i = child.index; i < a.length; i++) a[i].index = i;

		child.parent = null;

		return this;
	}

	initObjects(objects = {}) {
		return (
			Object.keys(objects)
				// .sort((a, b) => { if (objects[a].index < objects[b].index) { return -1 } else if (objects[a].index > objects[b].index) { return 1 } return 0; })
				.map(uuid => {
					const data = objects[uuid];

					let objMap = {
						line: Line,
						text: Text,
						button: Button,
						picture: Picture,
						iframe: Iframe,
						circleSlider: CircleSlider,
						slider: Slider,
						mathFormula: MathFormula
					};
					if (data.type === 'text') {
						data.contentConverted = true;
					}

					return new objMap[data.type](data, this, uuid);
				})
		);
	}

	render(width, height) {
		if (this.type === 'Renderer') return;

		if (this.type === '2DGroup') return this.children.forEach(c => c.render(width, height));

		this.objects.forEach(o => {
			o.render(width, height);
		});
	}
}

export default Layer;
export { Layer };

// WEBPACK FOOTER //
// ./src/Q3/layers/Layer.js
