
import * as cc from 'cc';
import detourModule from './recast-navigation/recastnavigation-js';

@cc._decorator.ccclass('NavMeshTest')
export class NavMeshTest extends cc.Component {
    start() {
        (async () => {
            const navMeshData = await this._loadNavMeshData();
            cc.log(`NavMesh loaded: ${navMeshData.byteLength} bytes.`);

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

                const startPoint = {x: 52.642, y: 1.534, z: 14.191};
                const extents = {x: 100, y: 100, z: 100};
                const filter = new detour.QueryFilter();
                const nearestPolyStart = navMeshQuery.findNearestPoly(startPoint, extents, filter);
                if (!detour.statusSucceed(nearestPolyStart.status)) {
                    throw new Error(`Failed to find nearest poly.`);
                }
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