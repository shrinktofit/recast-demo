
import * as cc from 'cc';

@cc._decorator.ccclass
export class FirstPersonCamera extends cc.Component {
    private _velocity = new cc.Vec3();
    private _positionCache = new cc.Vec3();
    private _rotationCache = new cc.Quat();
    private _touchDeltaCache = new cc.Vec2();
    private _targetRotation = new cc.Quat();
    private _buttonPressed = {
        [cc.EventMouse.BUTTON_LEFT]: false,
        [cc.EventMouse.BUTTON_MIDDLE]: false,
        [cc.EventMouse.BUTTON_RIGHT]: false,
    };
    private _scrollForwardAmount = 0;
    private _scrollForwardPast = 0;
    /**
     * Seconds.
     */
    private _scrollForwardDuration = 0.1;
    private _states = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
    };

    @cc._decorator.float
    public translationSpeed = 1.0;

    @cc._decorator.float
    public translationDamp = 5.0;

    @cc._decorator.float
    public rotationSpeed = 0.1;

    @cc._decorator.float
    public rotationDamp = 1.0;

    start () {
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_WHEEL, this._onMouseWheel, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this._onKeyDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, this._onKeyUp, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_START, this._onTouchStart, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_MOVE, this._onTouchMove, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.TOUCH_END, this._onTouchEnd, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_DOWN, this._onMouseDown, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_UP, this._onMouseUp, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_ENTER, this._onMouseEnter, this);
        cc.systemEvent.on(cc.SystemEvent.EventType.MOUSE_LEAVE, this._onMouseLeave, this);
    }

    update (deltaTime: number) {
        // Translation
        const nForward = (this._states.forward ? -1 : 0) + (this._states.backward ? 1 : 0);
        const nRight = (this._states.right ? 1 : 0) + (this._states.left ? -1 : 0);
        const nUp = (this._states.up ? 1 : 0) + (this._states.down ? -1 : 0);
        if (!nForward && !nRight && !nUp) {
            const length = cc.Vec3.len(this._velocity);
            cc.Vec3.normalize(this._velocity, this._velocity);
            const lengthFaded = length < 0.01 ? 0 : (length - deltaTime * this.translationDamp);
            cc.Vec3.multiplyScalar(this._velocity, this._velocity, lengthFaded);
        } else {
            this._velocity.set(nRight, nUp, nForward);
            cc.Vec3.multiplyScalar(this._velocity, this._velocity, this.translationSpeed);
            cc.Vec3.transformQuat(this._velocity, this._velocity, this.node.rotation);
        }
        if (!this._velocity.equals(cc.Vec3.ZERO)) {
            cc.Vec3.add(this._positionCache, this.node.position, this._velocity);
            this.node.position = this._positionCache;
        }

        if (this._scrollForwardPast < this._scrollForwardDuration) {
            this._scrollForwardPast += deltaTime;
            cc.Vec3.scaleAndAdd(this._positionCache, this.node.position, this._getForward(), this._scrollForwardAmount * deltaTime / this._scrollForwardDuration);
            this.node.position = this._positionCache;
        }
    }

    private _onMouseWheel(event: cc.EventMouse) {
        this._scrollForwardAmount = -event.getScrollY() * 0.05;
        this._scrollForwardPast = 0;
        // cc.Vec3.scaleAndAdd(this._positionCache, this.node.position, this._getForward(), -event.getScrollY() * 0.01);
        // this.node.position = this._positionCache;
    }

    private _onKeyDown(event: cc.EventKeyboard) {
        return this._onKeyUpOrDown(event, true);
    }

    private _onKeyUp(event: cc.EventKeyboard) {
        return this._onKeyUpOrDown(event, false);
    }

    private _onKeyUpOrDown(event: cc.EventKeyboard, keyDown: boolean) {
        switch (event.rawEvent.key) {
            case 'w':
                this._states.forward = keyDown;
                break;
            case 's':
                this._states.backward = keyDown;
                break;
            case 'a':
                this._states.left = keyDown;
                break;
            case 'd':
                this._states.right = keyDown;
                break;
            case 'q':
                this._states.down = keyDown;
                break;
            case 'e':
                this._states.up = keyDown;
                break;
        }
    }

    private _onMouseEnter(event: cc.EventMouse) {

    }

    private _onMouseLeave(event: cc.EventMouse) {
        for (const button of Object.keys(this._buttonPressed)) {
            this._buttonPressed[button] = false;
        }
    }

    private _onMouseDown (event: cc.EventMouse) {
        this._buttonPressed[event.getButton()] = true;
    }

    private _onMouseUp (event: cc.EventMouse) {
        this._buttonPressed[event.getButton()] = false;
    }

    private _onTouchStart () {
        if (cc.game.canvas.requestPointerLock) {
            cc.game.canvas.requestPointerLock();
        }
    }

    private _onTouchMove (touch: cc.Touch) {
        if (this._buttonPressed[cc.EventMouse.BUTTON_RIGHT]) {
            const touchDelta = touch.getDelta(this._touchDeltaCache);
            if (touchDelta.x) {
                cc.Quat.rotateAround(this._rotationCache, this.node.rotation, cc.Vec3.UNIT_Y, -touchDelta.x * this.rotationSpeed / 10 / 180.0 * Math.PI);
                this.node.rotation = this._rotationCache;
            }
            if (touchDelta.y) {
                const rotationAxis = this._getNatureRight();
                cc.Quat.rotateAround(this._rotationCache, this.node.rotation, rotationAxis, -touchDelta.y * this.rotationSpeed / 10 / 180.0 * Math.PI);
                this.node.rotation = this._rotationCache;
            }
        }
    }

    private _onTouchEnd () {
        if (document.exitPointerLock) {
            document.exitPointerLock();
        }
    }

    private _getForward(): Readonly<cc.Vec3> {
        return this.node.forward;
    }

    private _getUp(): Readonly<cc.Vec3> {
        return cc.Vec3.transformQuat(new cc.Vec3(), cc.Vec3.UNIT_Y, this.node.rotation);
    }

    private _getRight(): Readonly<cc.Vec3> {
        return cc.Vec3.transformQuat(new cc.Vec3(), cc.Vec3.UNIT_X, this.node.rotation);
    }

    private _getNatureRight(): Readonly<cc.Vec3> {
        const right = new cc.Vec3();
        cc.Vec3.cross(right, this._getForward(), cc.Vec3.UNIT_Y);
        cc.Vec3.normalize(right, right);
        return right;
    }
}