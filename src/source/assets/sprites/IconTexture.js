/**
 * @author Francisco https://github.com/SntsDev
 * @example https://codepen.io/SntsDev/pen/OZoMWb
 */

import { getOnBeforeCompile } from './../../../Q3/rendering/getOnBeforeCompile';
import * as THREE from 'three';

export const ICON_SHAPE = {
	SQUARE: 1,
	CIRCLE: 2,
	DIAMOND: 3
};

/**
 * Creates the texture for a Sprite Icon.
 * Receives an OBJECT with the parameters
 * @param {ICON_SHAPE} shape Use ICON_SHAPE const, select SQUARE, CIRCLE or DIAMOND
 * @param {Number} size Size of the canvas
 * @param {Number} borderRadius Radius for rounded corners, in percentage (10 = 10%)
 * @param {String} backgroundColor Background color (i.e. "#fff")
 * @param {Number} backgroundOpacity Background opacity (0 - 1)
 * @param {String} borderColor Border color (i.e. "#000")
 * @param {Number} borderWidth Border width (10)
 * @param {Number} borderOpacity Border opacity (0 - 1)
 * @param {String} iconUrl Icon Url
 * @param {String} iconColor Icon Color. If !== "", it will colorize the ICON
 * @param {Number} iconSize Icon Size (set Width as %, 1-100% of Canvas width, Height is auto)
 * @param {Number} scaleX Used to scale the uvScale
 * @param {Number} scaleY Used to scale the uvScale
 */
export class IconCanvas {
	constructor({
		shape = ICON_SHAPE.CIRCLE,
		size = 0,
		borderRadius = 5,
		backgroundColor = '#fff',
		backgroundOpacity = 1,
		borderColor = '#000',
		borderWidth = 10,
		borderOpacity = 1,
		iconHas = false,
		iconUrl = '',
		iconColorHas = false,
		iconColor = '',
		iconSize = 50,
		scaleX = 1,
		scaleY = 1
	}) {
		this.shape = shape;
		this.borderRadius = borderRadius;
		this.backgroundColor = backgroundColor;
		this.backgroundOpacity = backgroundOpacity;
		this.borderColor = borderColor;
		this.borderWidth = borderWidth;
		this.borderOpacity = borderOpacity;
		this.iconHas = iconHas;
		this.iconUrl = iconUrl;
		this.iconColorHas = iconColorHas;
		this.iconColor = iconColor;
		this.iconSize = iconSize;
		this.scaleX = scaleX;
		this.scaleY = scaleY;

		this.size = size ? size : this._calculateCanvasOptimalSize(scaleX, scaleY);

		var dpr = window.devicePixelRatio;

		this.canvas = document.createElement('canvas');
		this.canvas.width = this.size * dpr;
		this.canvas.height = this.size * dpr;
		this.canvas.setAttribute('data-origin', 'IconCanvas');

		this.ctx = this.canvas.getContext('2d');
		this.ctx.scale(dpr, dpr);
		this.ctx._scale = dpr;
	}

	get width() {
		return this.canvas.width;
	}
	get height() {
		return this.canvas.height;
	}

	_calculateCanvasOptimalSize(scaleX, scaleY) {
		let maxScale = Math.round(Math.max(scaleX, scaleY));

		maxScale = Math.max(Math.min(maxScale, 3), 0); //to get [64 - 512], before applying devicePixelRatio.

		return Math.pow(2, 7 + maxScale); //128 (=Math.pow(2,7)) is default for scale = 1
	}

	draw() {
		const scope = this;

		return new Promise((resolve, reject) => {
			drawShapeAndBorder(
				scope.ctx,
				scope.shape,
				scope.size,
				scope.backgroundColor,
				scope.backgroundOpacity,
				scope.borderColor,
				scope.borderWidth,
				scope.borderOpacity,
				scope.borderRadius
			);

			let image = new Image();
			image.dataOrigin = 'img-IconCanvas';

			if (!scope.iconHas || !scope.iconUrl) {
				resolve(scope.canvas);
			} else {
				addImage(
					scope.ctx,
					scope.iconUrl,
					scope.size,
					scope.iconSize,
					scope.iconColorHas,
					scope.iconColor,
					() => {
						resolve(scope.canvas);
					}
				);
			}
		});
	}
}

function drawShapeAndBorder(
	ctx,
	shape,
	size,
	backgroundColor,
	backgroundOpacity,
	borderColor,
	borderWidth,
	borderOpacity,
	borderRadius
) {
	const scale = window.devicePixelRatio;

	const toRGBA = (color, opacity) => {
		var c = new THREE.Color(color),
			r = Math.floor(c.r * 256),
			g = Math.floor(c.g * 256),
			b = Math.floor(c.b * 256),
			alpha = Math.max(Math.min(1, opacity), 0);

		return `rgba(${r},${g},${b},${alpha})`;
	};

	const makeCircle = side => {
		var half = Math.round(side / 2);
		ctx.beginPath();
		ctx.arc(half, half, half, 0, Math.PI * 2);
		ctx.closePath();
	};

	const makeSquare = (side, radius) => {
		var roundedPx = Math.round((side * radius) / 100),
			straightPx = side - 2 * roundedPx;

		ctx.beginPath();
		ctx.moveTo(roundedPx, 0);
		ctx.lineTo(roundedPx + straightPx, 0);
		ctx.quadraticCurveTo(side, 0, side, roundedPx);
		ctx.lineTo(side, roundedPx + straightPx);
		ctx.quadraticCurveTo(side, side, roundedPx + straightPx, side);
		ctx.lineTo(roundedPx, side);
		ctx.quadraticCurveTo(0, side, 0, roundedPx + straightPx);
		ctx.lineTo(0, roundedPx);
		ctx.quadraticCurveTo(0, 0, roundedPx, 0);
		ctx.closePath();
	};

	var mid = Math.floor(size / 2),
		backgroundStyle = toRGBA(backgroundColor, backgroundOpacity),
		borderStyle = toRGBA(borderColor, borderOpacity),
		CONST_DIAMOND = Math.sqrt(2) / 2;

	ctx.save();

	ctx.lineWidth = Math.round(((borderWidth / 100) * size * 2) / scale);
	ctx.fillStyle = backgroundStyle;
	ctx.strokeStyle = borderStyle;
	ctx.lineCap = 'square';

	switch (shape) {
		case ICON_SHAPE.SQUARE:
			makeSquare(size, borderRadius);
			break;

		case ICON_SHAPE.CIRCLE:
			makeCircle(size);
			break;

		case ICON_SHAPE.DIAMOND:
			ctx.translate(mid, mid);
			ctx.rotate(Math.PI / 4);
			ctx.translate(-mid * CONST_DIAMOND, -mid * CONST_DIAMOND);
			makeSquare(size * CONST_DIAMOND, borderRadius);
			break;

		default:
			console.warn('Invalid Shape ', shape);
	}

	ctx.clip();
	ctx.fill();
	ctx.stroke();

	ctx.restore();
}

function addImage(ctx, iconUrl, size, iconSize, iconColorHas, iconColor, cb) {
	if (!iconUrl) {
		return;
	}

	let img = new Image();
	img.crossOrigin = 'anonymous';

	img.onload = function() {
		let dpr = window.devicePixelRatio,
			w = img.naturalWidth || img.width,
			h = img.naturalHeight || img.height,
			iconWidth = Math.max(Math.min((size * iconSize) / 100, size), size / 100),
			iW = iconWidth,
			iH = Math.round((h / w) * iconWidth),
			dx = Math.floor((size - iW) / 2),
			dy = Math.floor((size - iH) / 2);

		ctx.save();

		if (iconColorHas) {
			var nc = document.createElement('canvas'),
				nctx;

			nc.width = iW * dpr;
			nc.height = iH * dpr;
			nctx = nc.getContext('2d');
			nctx.scale(dpr, dpr);

			nctx.fillStyle = iconColor;
			nctx.fillRect(0, 0, iW, iH);
			nctx.globalCompositeOperation = 'destination-atop';
			nctx.drawImage(img, 0, 0, iW, iH);
			ctx.drawImage(nc, dx, dy, iW, iH);
		} else {
			ctx.drawImage(img, dx, dy, iW, iH);
		}

		ctx.restore();

		if (cb) {
			cb();
		}
	};

	img.onerror = function() {
		if (cb) {
			cb();
		}
	};

	img.src = iconUrl;
}

/**
 * Creates the material for a Sprite Icon.
 * @param {THREE.Texture} texture Set the Icon > Texture
 */
export class HotspotSpriteMaterial {
	constructor(texture, scale = new THREE.Vector2(1, 1)) {
		let uniforms = THREE.UniformsUtils.merge([
			THREE.UniformsLib['common'],
			THREE.UniformsLib['fog'],
			THREE.UniformsLib['lights'],
			{
				scale: { type: 'v3', value: new THREE.Vector3(1, 1, 1) },
				uvScale: { type: 'v2', value: new THREE.Vector2(1, 1) },
				rotation: { value: 0 }
			}
		]);

		uniforms.map.value = texture;
		uniforms.scale.value = new THREE.Vector3(scale.x, scale.y, 1);

		let material = new THREE.ShaderMaterial({
			name: 'HotspotSpriteMaterial',
			uniforms,
			vertexShader: spriteVertexShader,
			fragmentShader: spriteFragmentShader,
			lights: true,
			fog: false,
			side: THREE.DoubleSide,
			blending: THREE.NormalBlending,
			transparent: true,
			depthTest: true
		});

		material.needsUpdate = true;
		material._iconConstructor = this;

		this.uniforms = uniforms;
		this.material = material;
	}

	setTexture(texture, needsUpdate = true) {
		this.material.uniforms.map.value = texture;
		if (needsUpdate) {
			this.material.needsUpdate = true;
		}
	}

	setScale(scaleX, scaleY, needsUpdate = true) {
		this.material.uniforms.scale.value = new THREE.Vector3(scaleX, scaleY, 1);
		if (needsUpdate) {
			this.material.needsUpdate = true;
		}
	}
}

/**
 * Creates the Mesh for a Sprite Icon.
 * @param {Object} iconCanvasParams Params for the IconCanvas constructor
 * @param {String} name Name of the Mesh
 */
export class HotspotMesh {
	constructor(iconCanvasParams, name) {
		this.iconCanvasParams = iconCanvasParams;
		this.name = name;
	}

	generateObject() {
		const scope = this;

		return new Promise((resolve, reject) => {
			//Create material using the IconCanvas class
			let newMap = new IconCanvas(scope.iconCanvasParams);

			//Draw, then add it
			newMap.draw().then(image => {
				//Texture
				let texture = new THREE.Texture(image);
				texture.needsUpdate = true;

				//Material
				const hotspotMaterial = new HotspotSpriteMaterial(texture);
				const mat = hotspotMaterial.material;
				mat.name = 'New Hotspot Material';
				mat.onBeforeCompile = getOnBeforeCompile(mat);

				//Geometry
				const geometry = generateSpriteGeometry();

				//Mesh
				let sprite = new THREE.Mesh(geometry, mat);
				sprite.name = scope.name;
				sprite.subType = 'IconHotspot';

				resolve({ sprite, material: mat, geometry });
			});
		});
	}
}

export const generateSpriteGeometry = function() {
	const geometry = new THREE.PlaneBufferGeometry(1, 1, 1, 1);

	geometry.addAttribute('worldObjectId', new THREE.BufferAttribute(new Float32Array([]), 1));

	return geometry;
};

const spriteVertexShader = `

#define SpriteGeometryPlaneShaderV

precision highp float;

uniform vec3 center;
uniform vec3 scale;
uniform vec2 uvOffset;
uniform vec2 uvScale;
uniform float rotation;
uniform vec3 color;

#include <logdepthbuf_pars_vertex>

varying vec2 vUv;

void main() {

vUv = uvOffset + uv * uvScale;

vec3 alignedPosition = ( position - center ) * scale;

vec2 rotatedPosition;
rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;

vec4 mvPosition;

mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );
mvPosition.xy += rotatedPosition;

gl_Position = projectionMatrix * mvPosition;

#include <logdepthbuf_vertex>


}`;

const spriteFragmentShader = `  

#define SpriteGeometryPlaneShaderF

precision highp float;

uniform float opacity;
uniform vec3 color;
uniform sampler2D map;

varying vec2 vUv;

#include <lightmap_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>

void main() {

#include <logdepthbuf_fragment>
#include <lightmap_fragment>

vec4 textureV = texture2D( map, vUv );
gl_FragColor = vec4( textureV.xyz, textureV.a );

//gl_FragColor = vec4( vUv.xy, 1, 0.5 );

#include <fog_fragment>

}`;

// WEBPACK FOOTER //
// ./src/Q3/assets/sprites/IconTexture.js
