/* eslint-disable promise/avoid-new */
console.debug(`📦 You are here → entering @titanium/updater`);

const moment = require('moment');
const semver = require('semver');
const turbo = require('/turbo');
console.debug(`turbo: ${JSON.stringify(turbo, null, 2)}`);
const Please = require('@titanium/please');

export class Updater {
	constructor({ url, timeout = 60000, id = Ti.App.id, platform = turbo.device.isIos ? 'iOS' : 'Android', version = Ti.App.version } = {}) {
		console.debug('📦 You are here →  @titanium/updater.constructor()');
		if (!url) {
			throw new Error('url is not defined for @titanium/updater');
		}
		this.url = url;
		this.id = id;
		this.platform = platform;
		this.version = version;
		this.api = new Please({
			baseUrl: this.url,
			timeout,
		});

	 }

	 ensure({ minVersion, latestVersion } = {}) {
		return new Promise(
			(resolve, reject) => {

				this.api.get()
					.then(result => {
						console.debug('📦 You are here →  @titanium/updater.ensure.then');
						console.debug(`result.json: ${JSON.stringify(result.json, null, 2)}`);

						const appInfo = _.find(result.json, { id: this.id, platform: this.platform });

						console.debug(`appInfo: ${JSON.stringify(appInfo, null, 2)}`);

						let satisfied = true;
						let mandatory = true;

						// info.required = '>=1.0.6';
						// info.latest = '1.0.8';
						// info.min = '1.0.6';

						let desiredVersion;

						if (! (minVersion || latestVersion || appInfo.latest || appInfo.min)) {
							console.warn(`no app version info found for app: ${this.id} platform: ${this.platform}`);
							return resolve();
						}


						if (minVersion) {
							satisfied = semver.satisfies(semver.coerce(this.version), minVersion);
							mandatory = !satisfied;
							desiredVersion = minVersion;
						} else if (appInfo.min) {
							satisfied = semver.gte(semver.coerce(this.version), appInfo.min);
							mandatory = !satisfied;
							desiredVersion = appInfo.min;
						}

						if (satisfied && latestVersion) {
							satisfied = semver.gte(semver.coerce(this.version), appInfo.latest);
							mandatory = false;
						} else if (satisfied && appInfo.latest) {
							satisfied = semver.gte(semver.coerce(this.version), appInfo.latest);
							mandatory = false;
						}

						console.error(`satisfied: ${satisfied}`);
						console.error(`mandatory: ${mandatory}`);

						console.warn(`appInfo: ${JSON.stringify(appInfo, null, 2)}`);

						// if (semver.satisfies(this.version, info.min)) {
						if (satisfied) {
							console.info(`App version ${this.version} meets requirements of: ${desiredVersion}`);
							return resolve();
						} else {
							console.error(`App version ${this.version} does not meet requirements of: ${desiredVersion}`);


							turbo.events.on(`updater::update`, function handleEvent(e, args) {
								console.debug(`📦 You are here → @titanium/updater handling event - updater::update`);
								turbo.events.off(`updater::update`, handleEvent);
								Titanium.Platform.openURL(appInfo['install-url'] || appInfo['update-url']);
								Alloy.close('update-required');
								// return resolve();
							});
							turbo.events.on(`updater::ignored`, function handleEvent(e, args) {
								console.debug(`📦 You are here → @titanium/updater handling event - updater::ignored`);
								turbo.events.off(`updater::ignored`, handleEvent);
								Alloy.close('update-required');
								return resolve();
							});


							Alloy.open('update-required', { optional: !mandatory });
							// return reject(new Error(`version ${this.version} does not meet requirements of: ${info.min}`));
						}

					})
					.catch(error => {
						console.error('⛔ → Error:  Error occurred in @titanium/updater.ensure()');
						console.error(error);
						console.error(`error: ${JSON.stringify(error, null, 2)}`);
						// resolve();
						reject(error);
					});

			});

	 }

	update() {
		console.debug(`📦 You are here → @titanium/updater.update()`);
		turbo.events.fire(`updater::update`);
	}

	ignore() {
		console.debug(`📦 You are here → @titanium/updater.ignore()`);
		turbo.events.fire(`updater::ignored`);
	}
}

module.exports = Updater;
