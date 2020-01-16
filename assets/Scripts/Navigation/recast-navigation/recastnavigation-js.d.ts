

declare namespace detour {
    class DBuffer {
        constructor (length: number);
        getBytes(): Uint8Array;
    }

    class NavMesh {
        constructor();
        static initWithData(navMesh: NavMesh, buffer: DBuffer, flags: number): Status;
    }

    function readRecastDemoSample(navMesh: NavMesh, buffer: DBuffer): Status;

    class FindNearestPolyResult {
        status: Status;
        poly: PolyRef;
        point: Point3;
    }

    class NavMeshQuery {
        constructor();
        init(navMesh: NavMesh, maxNodes: number): Status;
        findNearestPoly(center: Point3, extents: Point3, filter: QueryFilter): FindNearestPolyResult;
    }

    class QueryFilter {
    }

    class Point3 {
        x: number;
        y: number;
        z: number;
    }

    type PolyRef = number;

    type Status = number;

    function statusSucceed(status: Status): boolean;

    function statusFailed(status: Status): boolean;

    function statusInProgress(status: Status): boolean;

    function statusDetail(status: Status, detail: number): boolean;
}

declare function Module(): Promise<typeof detour>;

export default Module;