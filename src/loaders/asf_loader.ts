// from https://raw.githubusercontent.com/bailus/Threejs-asf-amc-loader/master/asfLoader.js
import * as THREE from 'three'

function stringToVec3(s: string) {
	const [x, y, z] = s.trim().split(' ').map(Number)
	return new THREE.Vector3(x, y, z)
}

export default class ASFLoader {
  constructor(
    public manager = THREE.DefaultLoadingManager,
  ) {}

  async load(url: string) {
    const loader = new THREE.FileLoader()
    return new Promise<THREE.AnimationClip>((resolve, reject) => {
      loader.load(url, (d) => resolve(this.parse(d)), undefined, reject)
    })
  }

  private parse(text: string | ArrayBuffer): THREE.AnimationClip {
		const lines = String(text).split('\n')
		let lineNum = 0

		function parseKeyValueMap() {
			const map: Record<string, string> = {}
			while (true) {
				const line = lines[lineNum].trim()
				
				if (line.startsWith('end') || line.startsWith(':')) {
					break
				}
				lineNum++

				const indexOfSpaceChar = line.indexOf(' ')
				if (indexOfSpaceChar === -1) {
					continue
				}
				map[line.slice(0, indexOfSpaceChar)] = line.slice(indexOfSpaceChar+1)
			}
			lineNum--
			return map
		}

		function parseBeginEnd() {
			lineNum++
			return parseKeyValueMap()
		}

		function parseBoneData() {
			const bones: any[] = []
			while (true) {
				const line = lines[lineNum].trim()
				if (line.startsWith(':')) {
					break
				}
				bones.push(parseBeginEnd())
				lineNum++
			}
			lineNum--
			return bones
		}

		function parseDocumentation() {
			const documentation: any[] = []
			while (true) {
				const line = lines[lineNum].trim()
				if (line.startsWith(':')) {
					break
				}
				lineNum++
				documentation.push(line)
			}
			lineNum--
			return documentation.join('\n')
		}

		const skeleton: Record<string, any> = {}

		for (; lineNum < lines.length; lineNum++) {
			const line = lines[lineNum].trim();
			if (!line.length || line.charAt(0) === '#') {
				continue
			}

			if (line.startsWith(':version')) {
				skeleton.version = line.slice(line.indexOf(' ')+1)
				continue
			}
			if (line.startsWith(':name')) {
				skeleton.name = line.slice(line.indexOf(' ')+1)
				continue
			}
			if (line.startsWith(':units')) {
				lineNum++
				skeleton.units = parseKeyValueMap()
				continue
			}

			if (line.startsWith(':documentation')) {
				lineNum++
				skeleton.documentation = parseDocumentation()
				continue
			}

			if (line.startsWith(':root')) {
				lineNum++
				skeleton.root = parseKeyValueMap()
				continue
			}

			if (line.startsWith(':bonedata')) {
				lineNum++
				skeleton.bonedata = parseBoneData()
				continue
			}

			if (line.startsWith(':hierarchy')) {
				lineNum++
				skeleton.hierarchy = parseBeginEnd()
				lineNum--
				continue
			}
		}

		skeleton.bonedata.findByName = function (name: string) {
			return skeleton.bonedata.find((one: any) => one.name === name)
		}
		skeleton.hierarchy.findByName = function (name: string) {
			return skeleton.hierarchy[name]
		}

		const bones: any[] = []
		function makeBone(
			name: string,
			position = new THREE.Vector3(),
			parentRotation = new THREE.Quaternion(),
		) {
			const data = skeleton.bonedata.findByName(name)
			if (!data) {
				return
			}

			const direction = stringToVec3(data.direction).normalize()

			const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction)

			const bone = new THREE.Bone()
			bone.name = name
			bone.position.copy(position)
			
			bone.quaternion.multiply(parentRotation.clone().inverse()) //back to world space rotation
			bone.quaternion.multiply(rotation) //to bone space (bone is along the positive z-axis)

			//amcLoader uses these:
			bone.userData.rotation = rotation.clone()
			bone.userData.parentRotation = parentRotation.clone()
			bone.userData.dof = data.dof
			bone.userData.axis = data.axis

			const endOfBone = new THREE.Vector3(0, 0, data.length)

			const skebone = skeleton.hierarchy.findByName(name) || ''
			skebone.split(' ').forEach((child: any) => {
				const childBone = makeBone(child, endOfBone, rotation.clone())
				if (childBone) {
					bone.add(childBone)
				}
			})

			bones.push(bone)
			return bone
		}

		function makeRoot() {
			const bone = new THREE.Bone()
			bones.push(bone)
			bone.position.copy(stringToVec3(skeleton.root.position))

			const childNames = skeleton.hierarchy.findByName('root')

			if (childNames) {
				childNames.split(' ').forEach((child: any) => {
					const b = makeBone(child, new THREE.Vector3(), new THREE.Quaternion())
					if (b) {
						bone.add(b)
					}
				})
			}
			return bone;
		}

		makeRoot()
		return bones as any
	}
}

