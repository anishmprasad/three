import * as THREE from 'three';

export class MeshIsolation {
	show(objectUuids, opacity = 0.2, duration = 0.2) {
		this.saveTransparency();

		//fade out last action if exists
		this.end();

		//fade in new action
		const clip = MeshIsolation.createAnumationClip(objectUuids, opacity);
		this.action = window.Q3.mixer.clipAction(clip);
		this.action.play();
		this.action.fadeDuration = duration;
		this.action.fadeIn(duration);
	}

	end() {
		if (this.action) {
			this.action.fadeOut(this.action.fadeDuration);
			const _action = this.action;
			setTimeout(() => {
				_action.stop();
				if (!this.action) {
					this.recoverTransparency();
				}
			}, this.action.fadeDuration * 1000);
			this.action = null;
		}
	}

	static createAnumationClip(objectUuids, opacity) {
		const tracks = [];
		for (var uuid in window.Q3.assets.objects) {
			if (window.Q3.assets.objects.hasOwnProperty(uuid) && objectUuids.indexOf(uuid) === -1) {
				const object = window.Q3.assets.objects[uuid];
				if (object instanceof THREE.Mesh) {
					tracks.push(MeshIsolation.createMeshOpacityTrack(uuid, opacity));
					//tracks.push( new THREE.BooleanKeyframeTrack(uuid + ".material.transparent", [0], [true], THREE.InterpolateDiscrete));
				}
			}
		}

		return new THREE.AnimationClip('isolation sequence', -1, tracks);
	}

	static createMeshOpacityTrack(meshUuid, opacity) {
		const times = new Float32Array(2);
		const values = new Float32Array(2);
		times[0] = 0;
		times[1] = 1;
		values[0] = opacity;
		values[1] = opacity;
		const track = new THREE.NumberKeyframeTrack(meshUuid + '.material.opacity', times, values);
		return track;
	}

	saveTransparency() {
		if (!this.transparencies) {
			this.transparencies = {};
			for (var uuid in window.Q3.assets.objects) {
				const object = window.Q3.assets.objects[uuid];
				if (object instanceof THREE.Mesh) {
					this.transparencies[uuid] = object.material.transparent;
					object.material.transparent = true;
				}
			}
		}
	}

	recoverTransparency() {
		if (this.transparencies) {
			for (var uuid in this.transparencies) {
				const object = window.Q3.assets.objects[uuid];
				if (object && object instanceof THREE.Mesh) {
					object.material.transparent = this.transparencies[uuid];
				}
			}
			this.transparencies = null;
		}
	}
}

// WEBPACK FOOTER //
// ./src/Q3/animations/meshIsolation.js
