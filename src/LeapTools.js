function addTool(parent, world, options) {
    "use strict";
    options = options || {};

    var toolLength = options.toolLength || 0.5;
    var toolRadius = options.toolLength || 0.016;
    var toolTime = options.toolTime || 0.03;
    var toolOffset = options.toolOffset || new THREE.Vector3(0, -0.3, -toolLength);
    var toolOffsetVR = options.toolOffsetVR || new THREE.Vector3(0, 0, -toolLength);

    var minConfidence = options.minConfidence || 0.25;
    var handOffset = options.handOffset || new THREE.Vector3(0, -0.25, -0.4);
    var handOffsetVR = options.handOffsetVR || new THREE.Vector3(0, 0, 0);

    var useTransform = options.useTransform;
    var transformOptions = options.transformOptions || {};

    // tool:
    var toolRoot = new THREE.Object3D();
    toolRoot.position.copy(toolOffset);
    parent.add(toolRoot);

    // hands don't necessarily correspond the left / right labels, but doesn't matter to me because they look indistinguishable
    var leftRoot = new THREE.Object3D(),
        rightRoot = new THREE.Object3D();
    leftRoot.position.copy(handOffset);
    rightRoot.position.copy(handOffset);
    var handRoots = [leftRoot, rightRoot];
    parent.add(leftRoot);
    parent.add(rightRoot);

    var leapController = new Leap.Controller({frameEventName: 'animationFrame'});

    var scale = 1;
    if (useTransform) {
        console.log("using 'transform' plugin");
        if (transformOptions.vr === true) {
            toolTime *= 2; // i guess this could help with vr tracking zaniness? im assuming reported hand.confidence already factors VR effects in (don't know)
            toolRoot.position.copy(toolOffsetVR);
            leftRoot.position.copy(handOffsetVR);
            rightRoot.position.copy(handOffsetVR);
        }
        console.log("'transform' options:");
        console.log(transformOptions);

        leapController.use('transform', transformOptions).connect();
    } else {
        console.log("not using 'transform' plugin");
        scale = 0.001;
        toolRoot.scale.set(scale, scale, scale);
        leftRoot.scale.set(scale, scale, scale);
        rightRoot.scale.set(scale, scale, scale);

        leapController.connect();
    }

    var onFrame = (function () {
        // setup tool: #########################
        var radius = toolRadius / scale;
        var length = toolLength / scale;

        var stickGeom = new THREE.CylinderGeometry(radius, radius, length, 10, 1, false, 0, 2*Math.PI);
        stickGeom.translate(0, -length / 2, 0);
        var stickMaterial = new THREE.MeshLambertMaterial({color: 0xeebb99, side: THREE.DoubleSide});
        var stickMesh = new THREE.Mesh(stickGeom, stickMaterial);
        stickMesh.castShadow = true;

        toolRoot.add(stickMesh);

        var tipMaterial = new THREE.MeshLambertMaterial({color: 0x004488});
        var tipMesh = new THREE.Mesh(new THREE.SphereBufferGeometry(radius), tipMaterial);
        tipMesh.castShadow = true;
        stickMesh.add(tipMesh);

        // TODO: mass
        var tipBody = new CANNON.Body({mass: 0.2, type: CANNON.Body.KINEMATIC});
        tipBody.addShape(new CANNON.Sphere(radius * scale));
        world.addBody(tipBody);

        // setup hands: ############################
        var handMaterial = new THREE.MeshLambertMaterial({color: 0x113399});
        radius = 0.03 / scale;
        length = 0.26 / scale;
        var armGeom = new THREE.CylinderGeometry(radius, radius, length);
        var armMesh = new THREE.Mesh(armGeom, handMaterial);
        var arms = [armMesh, armMesh.clone()];
        leftRoot.add(arms[0]);
        rightRoot.add(arms[1]);

        radius = 0.025 / scale;
        var palmGeom = new THREE.SphereBufferGeometry(radius, 16, 8).scale(1, 0.5, 1);
        var palmMesh = new THREE.Mesh(palmGeom, handMaterial);
        palmMesh.castShadow = true;
        var palms = [palmMesh, palmMesh.clone()];
        leftRoot.add(palms[0]);
        rightRoot.add(palms[1]);

        radius = 0.005 / scale;
        var fingerTipGeom = new THREE.SphereBufferGeometry(radius);
        var fingerTipMesh = new THREE.Mesh(fingerTipGeom, handMaterial);
        var fingerTips = [[fingerTipMesh, fingerTipMesh.clone(), fingerTipMesh.clone(), fingerTipMesh.clone(), fingerTipMesh.clone()],
                          [fingerTipMesh.clone(), fingerTipMesh.clone(), fingerTipMesh.clone(), fingerTipMesh.clone(), fingerTipMesh.clone()]];
        leftRoot.add(fingerTips[0][0], fingerTips[0][1], fingerTips[0][2], fingerTips[0][3], fingerTips[0][4]);
        rightRoot.add(fingerTips[1][0], fingerTips[1][1], fingerTips[1][2], fingerTips[1][3], fingerTips[1][4]);

        var jointMesh = fingerTipMesh.clone();
        jointMesh.scale.set(7/5, 7/5, 7/5);
        var joints = [[jointMesh, jointMesh.clone(), jointMesh.clone(), jointMesh.clone(), jointMesh.clone()],
                      [jointMesh.clone(), jointMesh.clone(), jointMesh.clone(), jointMesh.clone(), jointMesh.clone()]];
        leftRoot.add(joints[0][0], joints[0][1], joints[0][2], joints[0][3], joints[0][4]);
        rightRoot.add(joints[1][0], joints[1][1], joints[1][2], joints[1][3], joints[1][4]);

        // TODO: use the anatomical names
        // TODO: reduce fractions
        var joint2Mesh = fingerTipMesh.clone();
        joint2Mesh.scale.set(55/50, 55/50, 55/50);
        var joint2s = [[joint2Mesh, joint2Mesh.clone(), joint2Mesh.clone(), joint2Mesh.clone(), joint2Mesh.clone()],
                      [joint2Mesh.clone(), joint2Mesh.clone(), joint2Mesh.clone(), joint2Mesh.clone(), joint2Mesh.clone()]];
        leftRoot.add(joint2s[0][0], joint2s[0][1], joint2s[0][2], joint2s[0][3], joint2s[0][4]);
        rightRoot.add(joint2s[1][0], joint2s[1][1], joint2s[1][2], joint2s[1][3], joint2s[1][4]);


        var UP = new THREE.Vector3(0, 1, 0);
        var direction = new THREE.Vector3();
        var position = new THREE.Vector3();
        var velocity = new THREE.Vector3();

        // onFrame: ########################################
        return function (frame) {
            toolRoot.visible = false;
            if (frame.tools.length === 1) {
                toolRoot.visible = true;
                var tool = frame.tools[0];
                if (tool.timeVisible > toolTime) {
                    // TODO: option to toggle stabilized or not
                    // stickMesh.position.set(tool.tipPosition[0], tool.tipPosition[1], tool.tipPosition[2]);
                    stickMesh.position.set(tool.stabilizedTipPosition[0], tool.stabilizedTipPosition[1], tool.stabilizedTipPosition[2]);

                    direction.set(tool.direction[0], tool.direction[1], tool.direction[2]);
                    stickMesh.quaternion.setFromUnitVectors(UP, direction);

                    position.set(0, 0, 0);
                    stickMesh.localToWorld(position);
                    tipBody.position.copy(position);

                    velocity.set(tool.tipVelocity[0] * 0.001, tool.tipVelocity[1] * 0.001, tool.tipVelocity[2] * 0.001);
                    velocity.applyQuaternion(parent.quaternion);
                    tipBody.velocity.copy(velocity);
                }
            }

            leftRoot.visible = rightRoot.visible = false;
            frame.hands.forEach(function (hand, i) {
                if (hand.confidence > minConfidence) {
                    handRoots[i].visible = true;

                    direction.set(hand.arm.basis[2][0], hand.arm.basis[2][1], hand.arm.basis[2][2]);
                    arms[i].quaternion.setFromUnitVectors(UP, direction);
                    var center = hand.arm.center();
                    arms[i].position.set(center[0], center[1], center[2]);

                    direction.set(hand.palmNormal[0], hand.palmNormal[1], hand.palmNormal[2]);
                    palms[i].quaternion.setFromUnitVectors(UP, direction);
                    palms[i].position.set(hand.palmPosition[0], hand.palmPosition[1], hand.palmPosition[2]);

                    hand.fingers.forEach(function (finger, j) {
                        fingerTips[i][j].position.set(finger.tipPosition[0], finger.tipPosition[1], finger.tipPosition[2]);
                        joints[i][j].position.set(finger.bones[1].nextJoint[0], finger.bones[1].nextJoint[1], finger.bones[1].nextJoint[2]);
                        joint2s[i][j].position.set(finger.bones[2].nextJoint[0], finger.bones[2].nextJoint[1], finger.bones[2].nextJoint[2]);
                    });
                }
            });
        };

    })();

    leapController.on('frame', onFrame);
}
