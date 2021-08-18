// from https://raw.githubusercontent.com/bailus/Threejs-asf-amc-loader/master/asfLoader.js
import * as THREE from 'three'

export default class ASFLoader {
  constuctor(
    public manager = THREE.DefaultLoadingManager,
  ) {}

  setCrossOrigin(value) {
    this.crossOrigin = value
  }

  load(url, onLoad, onProgress, onError) {
		const loader = new THREE.XHRLoader(this.manager)
		loader.setCrossOrigin(this.crossOrigin)
		loader.load(url, (text) => {
			onLoad(this.parse(text))
		}, onProgress, onError)
  }

	parse(text: string) {
		var lines = text.split('\n');
		var lineNum = 0;

		var parseKeyValueMap = function () {
			var map = {};
			while (true) {
				var line = lines[lineNum].trim();
				
				if (line.startsWith('end') || line.startsWith(':')) break;
				lineNum++;


				var indexOfSpaceChar = line.indexOf(' ');
				if (indexOfSpaceChar === -1) continue;
				map[line.slice(0, indexOfSpaceChar)] = line.slice(indexOfSpaceChar+1)
				
			}
			lineNum--;
			return map;
		};

		var parseBeginEnd = function () {
			++lineNum;
			return parseKeyValueMap();
		};

		var parseBoneData = function () {
			var bones = [];
			while (true) {
				var line = lines[lineNum].trim();
				if (line.startsWith(':')) break;
				
				bones.push(parseBeginEnd());
				lineNum++;
			}
			lineNum--;
			return bones;
		};

		var parseDocumentation = function () {
			var documentation = [];
			while (true) {
				var line = lines[lineNum].trim();
				if (line.startsWith(':')) break;
				lineNum++;
				documentation.push(line);
			}
			lineNum--;
			return documentation.join('\n');
		};

		var skeleton = {};

		console.log('	parsing');

		for (; lineNum < lines.length; lineNum++) {

			var line = lines[lineNum].trim();
			if (!line.length || line.charAt(0) === '#') continue;

			if (line.startsWith(':version')) {
				skeleton.version = line.slice(line.indexOf(' ')+1);
				continue;
			}
			if (line.startsWith(':name')) {
				skeleton.name = line.slice(line.indexOf(' ')+1);
				continue;
			}
			if (line.startsWith(':units')) {
				lineNum++;
				skeleton.units = parseKeyValueMap();
				continue;
			}

			if (line.startsWith(':documentation')) {
				lineNum++;
				skeleton.documentation = parseDocumentation();
				continue;
			}

			if (line.startsWith(':root')) {
				lineNum++;
				skeleton.root = parseKeyValueMap();
				continue;
			}

			if (line.startsWith(':bonedata')) {
				lineNum++;
				skeleton.bonedata = parseBoneData();
				continue;
			}

			if (line.startsWith(':hierarchy')) {
				lineNum++;
				skeleton.hierarchy = parseBeginEnd();
				lineNum--;
				continue;
			}

		};

		console.log(skeleton)
		console.log('	creating bones')

		skeleton.bonedata.findByName = function (name) {
			for (var i = 0; i < skeleton.bonedata.length; i++)
				if (skeleton.bonedata[i].name === name) return skeleton.bonedata[i];
		};
		skeleton.hierarchy.findByName = function (name) {
			return skeleton.hierarchy[name];
		};

		var stringToVec3 = function (string) {
			var x = string.trim().split(' ');
			return new THREE.Vector3(x[0], x[1], x[2]);
		};

		var bones = [];
		var makeBone = function (name, position, parentRotation) {
			parentRotation = parentRotation || new THREE.Quaternion();
			position = position || new THREE.Vector3();

			var data = skeleton.bonedata.findByName(name);
			if (!data) return;

			var direction = stringToVec3(data.direction).normalize();

			var rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);

			var bone = new THREE.Bone();
			bone.name = name;
			bone.position.copy(position);
			
			bone.quaternion.multiply(parentRotation.clone().inverse()); //back to world space rotation
			bone.quaternion.multiply(rotation); //to bone space (bone is along the positive z-axis)

			//amcLoader uses these:
			bone.userData.rotation = rotation.clone();
			bone.userData.parentRotation = parentRotation.clone();
			bone.userData.dof = data.dof;
			bone.userData.axis = data.axis;


			var endOfBone = new THREE.Vector3(0, 0, data.length);

			(skeleton.hierarchy.findByName(name) || '').split(' ')
				.forEach(function (childName) {
					var childBone = makeBone(childName, endOfBone, rotation.clone());
					if (childBone) bone.add(childBone);
				});

			bones.push(bone);
			return bone;
		};

		var makeRoot = function () {

			var bone = new THREE.Bone();
			bones.push(bone);

			bone.position.copy(stringToVec3(skeleton.root.position));

			var childNames = skeleton.hierarchy.findByName("root");

			if (childNames) childNames.split(' ').forEach(function (childName) {
				bone.add(makeBone(childName, new THREE.Vector3(), new THREE.Quaternion()));
			});
			return bone;
		};

		makeRoot();
		console.log('	finished')
		return bones;
	}
}

