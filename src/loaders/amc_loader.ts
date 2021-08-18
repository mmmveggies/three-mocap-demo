// from https://raw.githubusercontent.com/bailus/Threejs-asf-amc-loader/master/amcLoader.js

import * as THREE from 'three'

const TimePerFrame = 1 / 120
const FirstFrameNumber = 1

function isNumeric(v: any): v is number {
  return !isNaN(v)
}

function angleToRadians(x: number) {
  return Math.PI * x / 180
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
        resolve(this.parse(String(text)))
      }, undefined, reject)
    })
  }

  private parse(text: string): THREE.AnimationClip {
		const lines = text.split('\n')
		let lineNum = 0

    function parseKeyValueMap () {
      const map: Record<string, string> = {}
			while (lineNum < lines.length) {
				const line = lines[lineNum].trim()
				
				if (isNumeric(line) || lineNum >= lines.length) {
          break
        }

				const indexOfSpaceChar = line.indexOf(' ');
				if (indexOfSpaceChar === -1) {
          continue
        }
				map[line.slice(0, indexOfSpaceChar)] = line.slice(indexOfSpaceChar+1)
				lineNum++
			}
			return map
		};

		const flags: string[] = []
		const frames: Array<Record<string, string>> = []

		function parseFlag(line: string) {
			lineNum++
			flags.push(line.slice(1).trim())
		}
		function parseFrame(line: string) {
			lineNum++
			frames[parseFloat(line)] = parseKeyValueMap()
		}

		while (lineNum < lines.length) {
			const line = lines[lineNum].trim();

			if (line.charAt(0) === ':') {
				parseFlag(line)
				continue
			}

			if (isNumeric(line)) {
				parseFrame(line)
				continue
			}

			lineNum++
		}

		var tracks = [];


		function getAxis(bone: any) {
			if (!bone.userData.axis) {
        return new THREE.Quaternion()
      }
			const axis = bone.userData.axis.trim().split(' ')
			const order = axis.pop()
			const euler = new THREE.Euler(angleToRadians(axis[0]), angleToRadians(axis[1]), angleToRadians(axis[2]), order)
			const quaternion = new THREE.Quaternion()
			quaternion.setFromEuler(euler)
			return quaternion
		}

    /*
		function getRotation(bone: any, frameData: any) {
			const quaternion = new THREE.Quaternion();
			let x: number | undefined, y: number | undefined, z: number | undefined
			let order = '';

			if (!bone.userData.dof) {
        return quaternion
      }
			const dof = bone.userData.dof.trim().split(' ')
			for (let i = 0; i < dof.length; i++) {
				if (dof[i] === 'rx') { x = frameData[i]; order += 'X'; }
				if (dof[i] === 'ry') { y = frameData[i]; order += 'Y'; }
				if (dof[i] === 'rz') { z = frameData[i]; order += 'Z'; }
			}
			if (x === undefined) { x = 0; order += 'X'; }
			if (y === undefined) { y = 0; order += 'Y'; }
			if (z === undefined) { z = 0; order += 'Z'; }
			const euler = new THREE.Euler(angleToRadians(x), angleToRadians(y), angleToRadians(z), order)
			quaternion.setFromEuler(euler)
			return quaternion
		}
    */

		/*
			order: a string from the dof or order fields in the amc file, eg. "TX TY TZ RX RY RZ" or "rx ry rz"
			data: a string of space seperated numbers corresponding to the transformations above
			returns a 4x4 transformation matrix (THREE.Matrix4)
		*/
		function getTransform(order?: string, data?: string) {
			const transform = new THREE.Matrix4()
			if (!order || !data) {
        return transform
      }

			const orders = order.trim().split(' ')
			const datas = data.trim().split(' ')
			if (orders.length !== datas.length) {
        return transform
      }

			for (let i = 0; i < order.length; i++) {
				const m = new THREE.Matrix4()
				const s = order[i].trim().toLowerCase()
			  const d = +data[i]
				const r = angleToRadians(d)

				if (s.length === 2) {
          transform.multiplyMatrices(
            s === 'rx' ? m.makeRotationX(r) :
            s === 'ry' ? m.makeRotationY(r) :
            s === 'rz' ? m.makeRotationZ(r) :
            s === 'tx' ? m.makeTranslation(d,0,0) :
            s === 'ty' ? m.makeTranslation(0,d,0) :
            s === 'tz' ? m.makeTranslation(0,0,d) :
            m,
            transform,
          )
        }
			}
			
			return transform
		}

		this.bones[0].updateMatrixWorld()

		for (let j = 0; j < this.bones.length; j++) {
			const bone = this.bones[j];

			if (!bone || !bone.userData || !bone.userData.axis) {
        continue
      }

			const keys = {
				translation: [] as any[],
				quaternion: [] as any[],
				scale: [] as any[],
			}

			const axis = getAxis(bone)
			const inverseAxis = axis.clone().conjugate()

			for (let i = FirstFrameNumber; i < frames.length; i++) {	
				const frame = frames[i]
				const t = TimePerFrame * i
				if (!frame || typeof frame[bone.name] !== "string") {
          continue
        }

				const translation = new THREE.Vector3()
				const quaternion = new THREE.Quaternion()
				const scale = new THREE.Vector3()
					
				getTransform(bone.userData.dof, frame[bone.name]).decompose(translation, quaternion, scale);

				const animationQuaternion = new THREE.Quaternion()
					.multiply(axis)
					.multiply(quaternion)
					.multiply(inverseAxis)

				keys.quaternion.push({
					time: t,
					value: new THREE.Quaternion()
									.multiply(bone.userData.parentRotation.clone().inverse()) //back to world space rotation
									.multiply(animationQuaternion)
									.multiply(bone.userData.rotation) //to bone space (bone is along the positive z-axis)
				})

				keys.translation.push({
					time: t,
					value: translation
				})

				keys.scale.push({
					time: t,
					value: scale
				})

			}

			if (keys.quaternion.length === 0) {
        continue
      }
			const track = new THREE.QuaternionKeyframeTrack(bone.uuid + '.quaternion', keys.quaternion)
			tracks.push(track)
		}

		const animationClip = new THREE.AnimationClip(this.name, TimePerFrame*frames.length, tracks)
		return animationClip
  }
}

