import {TRANSACTION_STORAGE_KEY_PREFIX} from './constants';

export default class TransactionManager {
    constructor(storage, clientId) {
        this.storage = storage;

        this.storageKey = `${TRANSACTION_STORAGE_KEY_PREFIX}.${clientId}`;
        this.transaction = this.storage.get(this.storageKey);
    }

    create(transaction) {
        this.transaction = transaction;

        this.storage.save(this.storageKey, transaction, {
            daysUntilExpire: 1
        });
    }

    get() {
        return this.transaction;
    }

    remove() {
        delete this.transaction;
        this.storage.remove(this.storageKey);
    }
}
