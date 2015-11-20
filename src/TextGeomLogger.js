var TextGeomLogger = (function () {
	"use strict";
	function TextGeomLogger(geometries, material, options) {
		this.geometries = geomeries;
		this.material = material;
		this.meshes = {};
		for (var c in this.geometries) {
			var geom = this.geometries[c].clone();
			this.meshes[c] = new THREE.Mesh(geom, material.clone());
		}
		this.logRoot = new THREE.Object3D();
		this.lineMeshBuffer = {};
		this.options = options || {size: 0.2, font: 'anonymous pro',
	                               rows: 20, columns: 80};

		this.log = function (msg) {
			var lines = msg.split('\n');
			for (var i = 0; i < lines.length && i < this.logRoot.children.length; i++) {
				var child = this.logRoot.children[i];
				child.position.y += 1.6 * this.options.size;
			}
			for (i = 0; i < lines.length; i++) {
				var line = lines[i];
				var mesh = this.lineMeshBuffer[line];
				if (mesh) {
					this.logRoot.add(mesh.clone());
				}
				else {
					mesh = new THREE.Object3D();
					this.logRoot.add(mesh);
					this.lineMeshBuffer[line] = mesh;
					for (var col = 0; col < line.length; col++) {
						var c = line[col];
						if (c !== ' ') {
							var letterMesh = this.meshes[c].clone();
							letterMesh.position.x = 1.6*this.options.size * col;
						}
					}
				}
			}
		}.bind(this);
	}
	
	return TextGeomLogger;

})();
