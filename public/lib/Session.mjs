
import * as uuidUtils from './uuid.mjs';

const SESSION_STORAGE_UUID = 'menhera.session.uuid';

export const session = new class Session extends EventTarget {
    constructor() {
        super();
        let uuid;
        try {
            uuid = sessionStorage.getItem(SESSION_STORAGE_UUID);
            if (!uuid) throw void 0;
        } catch (e) {
            uuid = uuidUtils.random();
            try {
                sessionStorage.setItem(SESSION_STORAGE_UUID, uuid);
            } catch (e) {}
        }
        Reflect.defineProperty(this, 'id', {value: uuid});
    }


};
