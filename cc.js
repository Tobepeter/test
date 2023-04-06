// ==UserScript==
// @name         cocos上下文注入
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        http://localhost:7456/
// @icon         http://localhost:7456/favicon.ico
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/* eslint-disable */
(async function () {
    'use strict';
    var LogPrefix = '[TamperMonkey]';

    log('init')
    await waitForCC();
    var cc = window.cc;

    function waitForCC() {
        var startTime = Date.now();
        return new Promise(resolve => {
            if (window.cc) {
                resolve();
            }
            var id = setInterval(() => {
                if (window.cc) {
                    clearTimeout(id);
                    var delta = Date.now() - startTime;
                    log(`cc ready, delta: ${delta}`);
                    resolve();
                }
            }, 200);
        })
    }

    function log(str) {

        // console.log(`%c${LogPrefix} ${str}`, 'background: #ccc; color: #bada55');
        // console.log(`%c${LogPrefix} ${str}`, 'font-weight: bold; background: #ddd;');
        console.log(`%c${LogPrefix} ${str}`, 'font-weight: bold; color: #000080;');
        // console.log(`${LogPrefix}🐒 ${str}`);
    }

    function safeSet(key, value) {
        if (assertKeyNotExists(key)) return;
        window[key] = value;
    }

    function assertKeyNotExists(key) {
        if (typeof window[key] !== 'undefined') {
            log(`${key} on window already exists!`);
        }
    }

    function printTree(node, indent = 0) {
        if (node) {
            var name = node.name || node.constructor.name;
            console.log(`${' '.repeat(indent)}${name}`);
            // console.log(`${' '.repeat(indent)}${name}`, node);
            if (node.children) {
                for (var i = 0; i < node.children.length; i++) {
                    printTree(node.children[i], indent + 2);
                }
            }
        }
    }

    function injectNode() {
        const Node = cc.Node;
        const get = (object, key, getter, enumerable = true, configurable = true) => {
            cc.js.get(object, key, getter, enumerable, configurable);
        }
        const getset = (object, key, getter, setter, enumerable = true, configurable = true) => {
            cc.js.getset(object, key, getter, setter, enumerable, configurable);
        }

        const proto = Node.prototype;
        get(proto, 'toggle', function () {
            this.active = !this.active;
        })

        const NUM = 10;
        for (let i = 0; i < NUM; i++) {
            let name = `ch${i}`;
            get(proto, name, function () {
                return this.children[i];
            })
        }

        get(proto, 'chs', function () {
            return this.children;
        })

        get(proto, 'chNames', function () {
            return this.children.map(c => c.name);
        })

        get(proto, 'pa', function () {
            return this.parent;
        }, true, true);

        const xyz = ['x', 'y', 'z'];
        for (let i = 0; i < xyz.length; i++) {
            let name = xyz[i];
            let propName = xyz[i];
            getset(proto, name, function () {
                return this.position[propName];
            }, function (v) {
                this.position[propName] = v;
                this.position = this.position;
            })
        }

        const r_xyz = ['rx', 'ry', 'rz'];
        for (var i = 0; i < r_xyz.length; i++) {
            var name = r_xyz[i];
            var propName = xyz[i];
            getset(proto, name, function () {
                return this.eulerAngles[propName];
            }, function (v) {
                this.eulerAngles[propName] = v;
                this.eulerAngles = this.eulerAngles;
            })
        }

        const s_xyz = ['sx', 'sy', 'sz'];
        for (var i = 0; i < s_xyz.length; i++) {
            var name = s_xyz[i];
            var propName = xyz[i];
            getset(proto, name, function () {
                return this.scale[propName];
            }, function (v) {
                this.scale[propName] = v;
                this.scale = this.scale;
            })
        }

    }

    function isUINode(node) {
        let parent = node;
        while (parent) {
            if (parent.getComponent(cc.Canvas)) {
                return true;
            }
            parent = parent.parent;
        }
        return false
    }

    function isUserClass(cls) {
        const className = cc.js.getClassName(cls);
        return !cc.misc.BUILTIN_CLASSID_RE.test(className);
    }

    safeSet('game', cc.game);
    safeSet('director', cc.director);
    safeSet('view', cc.view);
    safeSet('audioEngine', cc.audioEngine);
    safeSet('assetManager', cc.assetManager);

    safeSet('canvas', cc.game.canvas);
    safeSet('root', cc.director.root);
    safeSet('device', cc.director.root.device);
    safeSet('gl', cc.director.root.device.gl);

    assertKeyNotExists('scene');

    // 注意，切换场景一定会导致这些值变化，safeSet可能逻辑需要变化
    cc.director.on(cc.Director.EVENT_AFTER_SCENE_LAUNCH, (scene) => {
        window.scene = scene;

        // # print scene tree
        log(`scene: ${scene.name}`);
        printTree(scene);
        console.log('');

        // # find usual nodes
        let cam, uiCam, uiCanvas, dirLight;
        let labels = [], sprites = [], meshes = [];
        let nodeMap = {};
        let tComp;
        let camComp, uiCamComp, uiCanvasComp, dirLightComp;
        let labelComps = [], spriteComps = [], meshComps = [];

        scene.walk((node) => {
            if (!nodeMap[node.name]) {
                nodeMap[node.name] = node;
            }
            if (tComp = node.getComponent(cc.Camera)) {
                if (isUINode) {
                    uiCam = node;
                    uiCamComp = tComp;
                } else {
                    cam = node;
                    camComp = tComp;
                }
                return;
            }
            if (tComp = node.getComponent(cc.Canvas)) {
                uiCanvas = node;
                uiCanvasComp = tComp;
                return;
            }
            if (tComp = node.getComponent(cc.DirectionalLightComponent)) {
                dirLight = node;
                dirLightComp = tComp;
                return;
            }
            if (tComp = node.getComponent(cc.ModelComponent)) { // 注意，不是 cc.MeshRenderer
                meshes.push(node);
                meshComps.push(tComp);
                return;
            }
            if (tComp = node.getComponent(cc.Label)) {
                labels.push(node);
                labelComps.push(tComp);
                return;
            }
            if (tComp = node.getComponent(cc.Sprite)) {
                sprites.push(node);
                spriteComps.push(tComp);
                return;
            }

            // # user class
            node._components.forEach((comp) => {
                const cls = comp.constructor;
                if (isUserClass(cls)) {
                    const clsName = cc.js.getClassName(cls);
                    const winKey = clsName.toLowerCase();
                    safeSet(winKey, comp);
                }
            })

        });

        safeSet('nodeMap', nodeMap);
        safeSet('cam', cam);
        safeSet('uiCam', uiCam);
        safeSet('camComp', camComp);
        safeSet('uiCamComp', uiCamComp);
        safeSet('uiCanvas', uiCanvas);
        safeSet('uiCanvasComp', uiCanvasComp);
        safeSet('dirLight', dirLight);
        safeSet('dirLightComp', dirLightComp);

        for (let i = 0; i < meshes.length; i++) {
            const key = i > 0 ? `mesh${i}` : 'mesh';
            safeSet(key, meshes[i]);

            const compKey = i > 0 ? `meshComp${i}` : 'meshComp';
            safeSet(compKey, meshComps[i]);
        }

        for (let i = 0; i < labels.length; i++) {
            const key = i > 0 ? `label${i}` : 'label';
            safeSet(key, labels[i]);

            const compKey = i > 0 ? `labelComp${i}` : 'labelComp';
            safeSet(compKey, labelComps[i]);
        }
        safeSet('labels', labels);
        safeSet('labelComps', labelComps);

        for (let i = 0; i < sprites.length; i++) {
            const key = i > 0 ? `sprite${i}` : 'sprite';
            safeSet(key, sprites[i]);

            const compKey = i > 0 ? `spriteComp${i}` : 'spriteComp';
            safeSet(compKey, spriteComps[i]);
        }
        safeSet('sprites', sprites);
        safeSet('spriteComps', spriteComps);

        // # cocos default name
        const defaultNames = ['Cube', 'Cone', 'Cylinder', 'Plane', 'Quad', 'Sphere'];
        const nodeMapKeys = Object.keys(nodeMap);
        for (let i = 0; i < defaultNames.length; i++) {
            const defName = defaultNames[i];
            const lower = defName.toLowerCase();
            const regex = new RegExp(`^${defName}[\\s\\-]*(\\d*)?`, 'i');
            for (let j = 0; j < nodeMapKeys.length; j++) {
                const key = nodeMapKeys[j];
                const match = key.match(regex);
                if (match) {
                    const hasNum = match[1] !== undefined;
                    if (hasNum) {
                        safeSet(`${lower}${parseInt(match[1])}`, nodeMap[key]);
                    } else {
                        safeSet(lower, nodeMap[key]);
                    }
                }
            }
        }

    })

    injectNode();

})();