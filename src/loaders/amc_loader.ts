// from https://raw.githubusercontent.com/bailus/Threejs-asf-amc-loader/master/amcLoader.js

import THREE from 'three'

function isNumeric(v: any): v is number {
  return !isNaN(v)
}

export default class AMCLoader {
  constructor(
    public bones: any,
    public name: any,
  ) {}

  async load(url: string) {
    const loader = new THREE.FileLoader()
    return new Promise<THREE.AnimationClip>((resolve, reject) => {
      loader.load(url, (text) => {
        resolve(this.#parse(String(text)))
      }, undefined, reject)
    })
  }

  #parse(text: string): THREE.AnimationClip {
		const lines = text.split('\n');
		let lineNum = 0;

		var parseKeyValueMap = function () {
			var map = {};
			while (lineNum < lines.length) {
				var line = lines[lineNum].trim();
				
				if (isNumeric(line) || lineNum >= lines.length) break;

				var indexOfSpaceChar = line.indexOf(' ');
				if (indexOfSpaceChar === -1) continue;
				map[line.slice(0, indexOfSpaceChar)] = line.slice(indexOfSpaceChar+1)

				lineNum++;
			}
			return map;
		};

		var flags = [];
		var frames = [];

		var parseFlag = function (line) {
			lineNum++;
			flags.push(line.slice(1).trim());
		};
		var parseFrame = function (line) {
			lineNum++;
			frames[parseFloat(line)] = parseKeyValueMap();
		};

		console.log("	parsing")
		while (lineNum < lines.length) {

			var line = lines[lineNum].trim();

			if (line.charAt(0) === ':') {
				parseFlag(line);
				continue;
			}

			if (isNumeric(line)) {
				parseFrame(line);
				continue;
			}

			lineNum++;

		};

		console.log('	creating animation')

		var tracks = [];

		var TimePerFrame = 1/120;
		var FirstFrameNumber = 1;

		var angleToRadians = function (x) {
			return Math.PI * x / 180;
		};

		var getAxis = function (bone) { /* returns THREE.Quaternion */
			if (!bone.userData.axis) return new THREE.Quaternion();
			var axis = bone.userData.axis.trim().split(' ');
			var order = axis.pop();
			var euler = new THREE.Euler(angleToRadians(axis[0]), angleToRadians(axis[1]), angleToRadians(axis[2]), order);
			var quaternion = new THREE.Quaternion();
			quaternion.setFromEuler(euler);
			return quaternion;
		};

		var getRotation = function (bone, frameData) { /* returns THREE.Quaternion */
			var x, y, z;
			var order = '';
			var quaternion = new THREE.Quaternion();
			if (!bone.userData.dof) return quaternion;
			var dof = bone.userData.dof.trim().split(' ');
			for (var i = 0; i < dof.length; i++) {
				if (dof[i] == 'rx') { x = frameData[i]; order += 'X'; }
				if (dof[i] == 'ry') { y = frameData[i]; order += 'Y'; }
				if (dof[i] == 'rz') { z = frameData[i]; order += 'Z'; }
			}
			if (x === undefined) { x = 0; order += 'X'; }
			if (y === undefined) { y = 0; order += 'Y'; }
			if (z === undefined) { z = 0; order += 'Z'; }
			var euler = new THREE.Euler(angleToRadians(x), angleToRadians(y), angleToRadians(z), order);
			quaternion.setFromEuler(euler);
			return quaternion;
		};

		/*
			order: a string from the dof or order fields in the amc file, eg. "TX TY TZ RX RY RZ" or "rx ry rz"
			data: a string of space seperated numbers corresponding to the transformations above
			returns a 4x4 transformation matrix (THREE.Matrix4)
		*/
		var getTransform = function (order, data) {
			var transform = new THREE.Matrix4();

			if (!order || !data) return transform;
			order = order.trim().split(' ');
			data = data.trim().split(' ');
			if (order.length !== data.length) return transform;

			for (var i = 0; i < order.length; i++) {
				var m = new THREE.Matrix4(),
					s = order[i].trim().toLowerCase(),
					d = data[i],
					r = d * Math.PI / 180;

				if (s.length == 2) transform.multiplyMatrices(
					s == 'rx' ? m.makeRotationX(r) :
					s == 'ry' ? m.makeRotationY(r) :
					s == 'rz' ? m.makeRotationZ(r) :
					s == 'tx' ? m.makeTranslation(d,0,0) :
					s == 'ty' ? m.makeTranslation(0,d,0) :
					s == 'tz' ? m.makeTranslation(0,0,d) :
					m, transform);
			}
			
			return transform;
		};

		this.bones[0].updateMatrixWorld();

		for (var j = 0; j < this.bones.length; j++) {
			var bone = this.bones[j];

			if (!bone || !bone.userData || !bone.userData.axis) continue;

			var keys = {
				translation: [],
				quaternion: [],
				scale: []
			};

			var axis = getAxis(bone);
			var inverseAxis = axis.clone().conjugate();

			for (var i = FirstFrameNumber; i < frames.length; i++) {	
				var frame = frames[i],
					t = TimePerFrame * i;
				if (!frame || !(typeof frame[bone.name] === "string" || frame[bone.name] instanceof String)) continue;

				var translation = new THREE.Vector3(),
					quaternion = new THREE.Quaternion(),
					scale = new THREE.Vector3();
					
				getTransform(bone.userData.dof, frame[bone.name]).decompose(translation, quaternion, scale);

				var animationQuaternion = new THREE.Quaternion().
					multiply(axis).
					multiply(quaternion).
					multiply(inverseAxis);

				keys.quaternion.push({
					time: t,
					value: new THREE.Quaternion().
									multiply(bone.userData.parentRotation.clone().inverse()). //back to world space rotation
									multiply(animationQuaternion).
									multiply(bone.userData.rotation) //to bone space (bone is along the positive z-axis)
				});

				keys.translation.push({
					time: t,
					value: translation
				});

				keys.scale.push({
					time: t,
					value: scale
				});

			}

			if (keys.quaternion.length === 0) continue;
			var track = new THREE.QuaternionKeyframeTrack(bone.uuid + '.quaternion', keys.quaternion);
			tracks.push(track);
		}

		var animationClip = new THREE.AnimationClip(this.name, TimePerFrame*frames.length, tracks);
		console.log('	finished')
		return animationClip
  }
}

