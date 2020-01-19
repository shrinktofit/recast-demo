
import * as cc from 'cc';
import detourModule, { IPolyRefVector, Point3 } from './recast-navigation/recastnavigation-js';

@cc._decorator.ccclass('NavMeshTest')
export class NavMeshTest extends cc.Component {
    start() {
        (async () => {
            const navMeshData = await this._loadNavMeshData();
            cc.log(`NavMesh loaded: ${navMeshData.byteLength} bytes.`);

            const wayPointPrefab = await new Promise<cc.Prefab>((resolve, reject) => {
                cc.loader.loadRes<cc.Prefab>('WayPoint', cc.Prefab, (error, prefab) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(prefab!);
                    }
                })
            });

            detourModule().then((detour) => {
                const navMeshDataBuffer = new detour.DBuffer(navMeshData.byteLength);
                const navMeshDataBufferBytes = navMeshDataBuffer.getBytes();
                navMeshDataBufferBytes.set(navMeshData);

                const navMesh = new detour.NavMesh();
                let status = detour.readRecastDemoSample(navMesh, navMeshDataBuffer);
                // let status = detour.NavMesh.initWithData(navMesh, navMeshDataBuffer, 0);
                if (!detour.statusSucceed(status)) {
                    throw new Error(`Failed to init NavMesh.`);
                }

                const navMeshQuery = new detour.NavMeshQuery();
                status = navMeshQuery.init(navMesh, 1024);
                if (!detour.statusSucceed(status)) {
                    throw new Error(`Failed to init NavMeshQuery.`);
                }

                const filter = new detour.QueryFilter();

                type PolyRef = number;

                interface SteerTarget {
                    steerPosition: cc.Vec3;
                    steerPositionFlag: number;
                    steerPositionPoly: PolyRef;
                    outPoints?: cc.Vec3[];
                    outPointsCount?: number;
                }

                function inRange(v1: Readonly<Point3>, v2: Readonly<Point3>, r: number, h: number) {
                    const dx = v2.x - v1.x;
                    const dy = v2.y - v1.y;
                    const dz = v2.z - v1.z;
                    return (dx * dx + dz * dz) < r * r && Math.abs(dy) < h;
                }

                function getSteerTarget(start: Readonly<Point3>, end: Readonly<Point3>, minTargetDist: number,
                    path: any, pathSize: number, target: SteerTarget): boolean {
                    // Find steer target
                    const MAX_STEER_POINTS = 3;
                    const straightPath = new detour.StraightPath(MAX_STEER_POINTS);
                    const result = navMeshQuery.findStraightPath(start, end, path, pathSize, 0, straightPath);
                    const nSteerPath = result.size;
                    if (!nSteerPath) {
                        return false;
                    }

                    if ((target.outPoints !== undefined) && (target.outPointsCount !== undefined)) {
                        target.outPointsCount = nSteerPath;
                        for (let i = 0; i < nSteerPath; ++i) {
                            cc.Vec3.set(target.outPoints[i], straightPath.getPath(i, 0), straightPath.getPath(i, 1), straightPath.getPath(i, 2));
                        }
                    }

                    // Find vertex far enough to steer to.
                    let ns = 0;
                    while (ns < nSteerPath) {
                        // Stop at Off-Mesh link or when point is further than slop away.
                        const p = new cc.Vec3(straightPath.getPath(ns, 0), straightPath.getPath(ns, 1), straightPath.getPath(ns, 2));
                        if ((straightPath.getFlag(ns) & detour.STRAIGHTPATH_OFFMESH_CONNECTION) ||
                            !inRange(p, start, minTargetDist, 1000.0)) {
                            break;
                        }
                        ns++;
                    }
                    // Failed to find good point to steer to.
                    if (ns >= nSteerPath) {
                        return false;
                    }

                    cc.Vec3.set(target.steerPosition, straightPath.getPath(ns, 0), straightPath.getPath(ns, 1), straightPath.getPath(ns, 2));
                    target.steerPosition.y = start.y; // ????
                    target.steerPositionFlag = straightPath.getFlag(ns);
                    target.steerPositionPoly = straightPath.getPoly(ns);
                    return true;
                }

                function pathFollow(startPoly: number, startPosition: Readonly<cc.Vec3>, endPosition: Readonly<cc.Vec3>, polys: IPolyRefVector, npolys: number) {
                    const iterPos = new detour.Point3Object();
                    const targetPos = new detour.Point3Object();
                    // TODO check result
                    navMeshQuery.closestPointOnPoly(startPoly, startPosition, iterPos);
                    // TODO check result
                    navMeshQuery.closestPointOnPoly(polys.get(polys.size() - 1), endPosition, targetPos);

                    const STEP_SIZE = 0.5;
                    const SLOP = 0.01;

                    const smoothPath = new Array<cc.Vec3>(128);
                    for (let i = 0; i < smoothPath.length; ++i) {
                        smoothPath[i] = new cc.Vec3();
                    }
                    cc.Vec3.copy(smoothPath[0], iterPos);

                    let m_nsmoothPath = 1;
                    const MAX_SMOOTH = smoothPath.length;
                    while (npolys && m_nsmoothPath < smoothPath.length)
                    {
                        // Find location to steer towards.
                        const steerTarget: SteerTarget = {
                            steerPosition: new cc.Vec3(),
                            steerPositionFlag: 0,
                            steerPositionPoly: 0,
                        };
                        if (!getSteerTarget(iterPos, targetPos, SLOP,
                                            polys,  npolys, steerTarget)) {
                            break;
                        }
                        
                        const steerPos = steerTarget.steerPosition;
                        const steerPosFlag = steerTarget.steerPositionFlag;
                        const steerPosRef = steerTarget.steerPositionPoly;
                        
                        const endOfPath = (steerPosFlag & detour.STRAIGHTPATH_END) ? true : false;
                        const offMeshConnection = (steerPosFlag & detour.STRAIGHTPATH_OFFMESH_CONNECTION) ? true : false;
                        
                        // Find movement delta.
                        const delta = cc.Vec3.subtract(new cc.Vec3(), steerPos, cc.Vec3.clone(iterPos));
                        let len = cc.Vec3.len(delta);
                        // If the steer target is end of path or off-mesh link, do not move past the location.
                        if ((endOfPath || offMeshConnection) && len < STEP_SIZE) {
                            len = 1;
                        } else {
                            len = STEP_SIZE / len;
                        }
                        const moveTgt = cc.Vec3.scaleAndAdd(new cc.Vec3(), cc.Vec3.clone(iterPos), delta, len);
                        
                        // Move
                        const visited = detour.makePolyRefVector(16, 0);
                        const result = new detour.Point3Object();
                        const { visitedSize: nvisited } = navMeshQuery.moveAlongSurface(
                            polys.get(0),
                            iterPos,
                            moveTgt,
                            filter,
                            result,
                            visited,
                        );

                        npolys = detour.Utils.fixupCorridor(polys, npolys, visited, nvisited);
                        npolys = detour.Utils.fixupShortcuts(polys, npolys, navMeshQuery);

                        const { height: h } = navMeshQuery.getPolyHeight(polys.get(0), result);
                        result.y = h;
                        cc.Vec3.copy(iterPos, result);

                        // Handle end of path and off-mesh links when close enough.
                        if (endOfPath && inRange(iterPos, steerPos, SLOP, 1.0)) {
                            // Reached end of path.
                            cc.Vec3.copy(iterPos, targetPos);
                            if (m_nsmoothPath < MAX_SMOOTH) {
                                cc.Vec3.copy(smoothPath[m_nsmoothPath], iterPos);
                                m_nsmoothPath++;
                            }
                            break;
                        } else if (offMeshConnection && inRange(iterPos, steerPos, SLOP, 1.0)) {
                            // Reached off-mesh connection.
                            const startPos = new cc.Vec3();
                            const endPos = new cc.Vec3();
                            
                            // Advance the path up to and over the off-mesh connection.
                            let prevRef: PolyRef = 0;
                            let polyRef: PolyRef = polys.get(0);
                            let npos = 0;
                            while (npos < npolys && polyRef != steerPosRef) {
                                prevRef = polyRef;
                                polyRef = polys.get(npos);
                                npos++;
                            }
                            for (let i = npos; i < npolys; ++i) {
                                polys.set(i-npos, polys.get(i));
                            }
                            npolys -= npos;
                            
                            // Handle the connection.
                            const status = navMesh.getOffMeshConnectionPolyEndPoints(prevRef, polyRef, startPos, endPos);
                            if (detour.statusSucceed(status)) {
                                if (m_nsmoothPath < MAX_SMOOTH)
                                {
                                    cc.Vec3.copy(smoothPath[m_nsmoothPath], startPos);
                                    m_nsmoothPath++;
                                    // Hack to make the dotted path not visible during off-mesh connection.
                                    if (m_nsmoothPath & 1) {
                                        cc.Vec3.copy(smoothPath[m_nsmoothPath], startPos);
                                        m_nsmoothPath++;
                                    }
                                }
                                // Move position at the other side of the off-mesh link.
                                cc.Vec3.copy(iterPos, endPos);
                                const polyHeight = navMeshQuery.getPolyHeight(polys.get(0), iterPos);
                                iterPos.y = polyHeight.height;
                            }
                        }
                        
                        // Store results.
                        if (m_nsmoothPath < MAX_SMOOTH) {
                            cc.Vec3.copy(smoothPath[m_nsmoothPath], iterPos);
                            m_nsmoothPath++;
                        }
                    }

                    return smoothPath.slice(0, m_nsmoothPath);
                }

                const getCurrentPoints = () => {
                    const startName = 'StartPoint';
                    const endName = 'EndPoint';
                    const getPointPosition = (name: string) => {
                        const node = cc.director.getScene()!.getChildByName(name);
                        if (!node) {
                            throw new Error(`There is no node: ${name}`);
                        }
                        return cc.Vec3.clone(node.position);
                    };
                    return {
                        start: getPointPosition(startName),
                        end: getPointPosition(endName),
                    };
                };

                const findPath = (() => {
                    return (start: Readonly<cc.Vec3>, end: Readonly<cc.Vec3>, extents: Readonly<cc.Vec3>) => {
                        const nearestPolyStart = navMeshQuery.findNearestPoly({
                            x: start.x,
                            y: start.y,
                            z: start.z,
                        }, extents, filter);
                        if (!detour.statusSucceed(nearestPolyStart.status)) {
                            throw new Error(`Failed to find nearest poly.`);
                        }
                        if (nearestPolyStart.poly === 0) {
                            throw new Error(`The search box does not intersect any polygons!`);
                        }

                        const nearestPolyEnd = navMeshQuery.findNearestPoly({
                            x: end.x,
                            y: end.y,
                            z: end.z,
                        }, extents, filter);
                        if (!detour.statusSucceed(nearestPolyEnd.status)) {
                            throw new Error(`Failed to find nearest poly.`);
                        }
                        if (nearestPolyEnd.poly === 0) {
                            throw new Error(`The search box does not intersect any polygons!`);
                        }

                        const maxPaths = detour.makePolyRefVector(128, 0);
                        const findPathResult = navMeshQuery.findPath(
                            nearestPolyStart.poly,
                            nearestPolyEnd.poly,
                            nearestPolyStart.point,
                            nearestPolyEnd.point,
                            filter,
                            maxPaths);
                        if (!detour.statusSucceed(findPathResult.status)) {
                            throw new Error(`Failed to find path.`);
                        }

                        const paths = new Array<number>(findPathResult.size);
                        for (let i = 0; i < paths.length; ++i) {
                            paths[i] = maxPaths.get(i);
                        }
                        cc.log(`Find path success: ${paths}`);

                        const followedPath = pathFollow(
                            nearestPolyStart.poly,
                            cc.Vec3.clone(nearestPolyStart.point),
                            cc.Vec3.clone(nearestPolyEnd.point),
                            maxPaths,
                            findPathResult.size,
                        );
                        cc.log(`Follow path: ${followedPath.map((p) => `${p.x}, ${p.y}, ${p.z}`).join('\n')}`);

                        for (const p of followedPath) {
                            const wp: cc.Node = cc.instantiate(wayPointPrefab);
                            wp.active = true;
                            this.node.parent?.addChild(wp);

                            wp.setPosition(p);
                        }
                    }
                })();

                const findPathNow = (() => {
                    const defaultExtents = new cc.Vec3(2, 4, 2);
                    return () => {
                        const points = getCurrentPoints();
                        findPath(points.start, points.end, defaultExtents);
                    };
                })();

                findPathNow();
            });
        })();
    }

    // private async _loadNavMeshData(): Promise<Uint8Array> {
    //     const navMeshDataResponse = await fetch('./solo_navmesh.bin');
    //     if (!navMeshDataResponse.ok) {
    //         return Promise.reject(new Error(`Failed to load navigation mesh.`));
    //     }
    //     const navMeshData = await navMeshDataResponse.arrayBuffer();
    //     return new Uint8Array(navMeshData);
    // }

    private async _loadNavMeshData(): Promise<Uint8Array> {
        return new Promise<Uint8Array>((resolve, reject) => {
            cc.loader.loadRes<cc.RawAsset>('solo_navmesh.bin', cc.Asset, (error, asset) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(new Uint8Array(asset._file));
                }
            });
        });
    }
}