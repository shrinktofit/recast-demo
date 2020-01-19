

export type PolyRef = number;

export type Status = number;

export type IPolyRefVector = StdVector<PolyRef>;

export interface Point3 {
    x: number;
    y: number;
    z: number;
}

export interface StdVector<T> {
    size(): number;
    set(index: number, value: T): void;
    get(index: number): T;
    push_back(value: T): void;
    resize(size: number, value: T): void; 
}

declare namespace detour {
    const PolyRefVector: Constructor<IPolyRefVector>;

    function makePolyRefVector(size: number, value: PolyRef): IPolyRefVector;

    class DBuffer {
        constructor (length: number);
        getBytes(): Uint8Array;
    }

    class NavMesh {
        constructor();
        static initWithData(navMesh: NavMesh, buffer: DBuffer, flags: number): Status;
        getOffMeshConnectionPolyEndPoints(prevPoly: PolyRef, endPoly: PolyRef, startPosition: Point3, endPosition: Point3): Status;
    }

    function readRecastDemoSample(navMesh: NavMesh, buffer: DBuffer): Status;

    class StraightPath {
        constructor(size: number);
        size(): number;
        getPath(index: number, component: 0 | 1 | 2): number;
        getFlag(index: number): number;
        getPoly(index: number): PolyRef;
    }

    class NavMeshQuery {
        constructor();
        init(navMesh: NavMesh, maxNodes: number): Status;

        findNearestPoly(center: Point3, extents: Point3, filter: QueryFilter): {
            status: Status;
            poly: PolyRef;
            point: Point3;
        };

        findPath(startPoly: PolyRef, endPoly: PolyRef, startPoint: Point3, endPoint: Point3, filter: QueryFilter, path: IPolyRefVector): {
            status: Status;
            size: number;
        };

        findStraightPath(
            start: Readonly<Point3>,
            end: Readonly<Point3>,
            path: Readonly<IPolyRefVector>,
            pathSize: number,
            options: number,
            straightPath: StraightPath,
            ): {
            status: Status;
            size: number;
        };

        closestPointOnPoly(
            poly: PolyRef,
            position: Readonly<Point3>,
            closest: Point3Object,
            ): {
            status: Status;
            posOverPoly: boolean;
        };

        getPolyHeight(
            poly: PolyRef,
            position: Readonly<Point3>,
            ): {
            status: Status;
            height: number;
        };

        moveAlongSurface(
            startPoly: PolyRef,
            startPosition: Readonly<Point3>,
            endPosition: Readonly<Point3>,
            filter: QueryFilter,
            resultPosition: Point3Object,
            visited: IPolyRefVector,
        ): {
            status: Status;
            visitedSize: number;
        };
    }

    class QueryFilter {
    }

    class Point3Object implements Point3 {
        x: number;
        y: number;
        z: number;
        declare __unique: number;
    }

    function statusSucceed(status: Status): boolean;

    function statusFailed(status: Status): boolean;

    function statusInProgress(status: Status): boolean;

    function statusDetail(status: Status, detail: number): boolean;

    const STRAIGHTPATH_START: number;
    const STRAIGHTPATH_END: number;
    const STRAIGHTPATH_OFFMESH_CONNECTION: number;

    class Utils {
        static fixupCorridor(path: IPolyRefVector, pathSize: number, visited: IPolyRefVector, visitedSize: number): number;
        static fixupShortcuts(path: IPolyRefVector, pathSize: number, query: NavMeshQuery): number;
    }
}

declare function Module(): Promise<typeof detour>;

export default Module;