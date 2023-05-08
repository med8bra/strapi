'use strict';

const {
  file: {
    providers: { createLocalFileSourceProvider },
  },
  strapi: {
    providers: { createLocalStrapiDestinationProvider, DEFAULT_CONFLICT_STRATEGY },
  },
  engine: { createTransferEngine, DEFAULT_VERSION_STRATEGY, DEFAULT_SCHEMA_STRATEGY },
} = require('@strapi/data-transfer');

const { isObject } = require('lodash/fp');

const {
  buildTransferTable,
  DEFAULT_IGNORED_CONTENT_TYPES,
  createStrapiInstance,
  formatDiagnostic,
  loadersFactory,
  exitMessageText,
  abortTransfer,
  getTransferTelemetryPayload,
  setSignalHandler,
} = require('../../utils/data-transfer');
const { exitWith } = require('../../utils/helpers');
const { confirmMessage } = require('../../utils/commander');

/**
 * @typedef {import('@strapi/data-transfer/src/file/providers').ILocalFileSourceProviderOptions} ILocalFileSourceProviderOptions
 */

/**
 * @typedef ImportCommandOptions Options given to the CLI import command
 *
 * @property {string} [file] The file path to import
 * @property {string} [key] Encryption key, used when encryption is enabled
 * @property {(keyof import('@strapi/data-transfer/src/engine').TransferGroupFilter)[]} [only] If present, only include these filtered groups of data
 * @property {(keyof import('@strapi/data-transfer/src/engine').TransferGroupFilter)[]} [exclude] If present, exclude these filtered groups of data
 * @property {number|undefined} [throttle] Delay in ms after each record
 */

/**
 * Import command.
 *
 * It transfers data from a file to a local Strapi instance
 *
 * @param {ImportCommandOptions} opts
 */
module.exports = async (opts) => {
  // validate inputs from Commander
  if (!isObject(opts)) {
    exitWith(1, 'Could not parse arguments');
  }

  /**
   * From strapi backup file
   */
  const sourceOptions = getLocalFileSourceOptions(opts);

  const source = createLocalFileSourceProvider(sourceOptions);

  /**
   * To local Strapi instance
   */
  const strapiInstance = await createStrapiInstance();

  const destinationOptions = {
    async getStrapi() {
      return strapiInstance;
    },
    autoDestroy: false,
    strategy: opts.conflictStrategy || DEFAULT_CONFLICT_STRATEGY,
    restore: {
      entities: { exclude: DEFAULT_IGNORED_CONTENT_TYPES },
    },
  };
  const destination = createLocalStrapiDestinationProvider(destinationOptions);

  /**
   * Configure and run the transfer engine
   */
  const engineOptions = {
    versionStrategy: opts.versionStrategy || DEFAULT_VERSION_STRATEGY,
    schemaStrategy: opts.schemaStrategy || DEFAULT_SCHEMA_STRATEGY,
    exclude: opts.exclude,
    only: opts.only,
    throttle: opts.throttle,
    rules: {
      links: [
        {
          filter(link) {
            return (
              !DEFAULT_IGNORED_CONTENT_TYPES.includes(link.left.type) &&
              !DEFAULT_IGNORED_CONTENT_TYPES.includes(link.right.type)
            );
          },
        },
      ],
      entities: [
        {
          filter: (entity) => !DEFAULT_IGNORED_CONTENT_TYPES.includes(entity.type),
        },
      ],
    },
  };

  const engine = createTransferEngine(source, destination, engineOptions);

  engine.diagnostics.onDiagnostic(formatDiagnostic('import'));

  const progress = engine.progress.stream;

  const { updateLoader } = loadersFactory();

  engine.onSchemaDiff(async (context, next) => {
    // if we abort here, we need to actually exit the process because of conflict with inquirer prompt
    setSignalHandler(async () => {
      await abortTransfer({ engine, strapi });
      exitWith(1, exitMessageText('import', true));
    });

    const confirmed = await confirmMessage(
      'There are differences in schema between the source and destination, and the data listed above will be lost. Are you sure you want to continue?',
      {
        force: opts.force,
      }
    );

    // reset handler back to normal
    setSignalHandler(() => abortTransfer({ engine, strapi }));

    if (confirmed) {
      context.diffs = [];
      return next(context);
    }

    return next(context);
  });

  progress.on(`stage::start`, ({ stage, data }) => {
    updateLoader(stage, data).start();
  });

  progress.on('stage::finish', ({ stage, data }) => {
    updateLoader(stage, data).succeed();
  });

  progress.on('stage::progress', ({ stage, data }) => {
    updateLoader(stage, data);
  });

  progress.on('transfer::start', async () => {
    console.log('Starting import...');
    await strapiInstance.telemetry.send(
      'didDEITSProcessStart',
      getTransferTelemetryPayload(engine)
    );
  });

  let results;
  try {
    // Abort transfer if user interrupts process
    setSignalHandler(() => abortTransfer({ engine, strapi }));

    results = await engine.transfer();
  } catch (e) {
    await strapiInstance.telemetry.send('didDEITSProcessFail', getTransferTelemetryPayload(engine));
    exitWith(1, exitMessageText('import', true));
  }

  try {
    const table = buildTransferTable(results.engine);
    console.log(table.toString());
  } catch (e) {
    console.error('There was an error displaying the results of the transfer.');
  }

  // Note: we need to await telemetry or else the process ends before it is sent
  await strapiInstance.telemetry.send('didDEITSProcessFinish', getTransferTelemetryPayload(engine));
  await strapiInstance.destroy();

  exitWith(0, exitMessageText('import'));
};

/**
 * Infer local file source provider options based on a given filename
 *
 * @param {{ file: string; key?: string }} opts
 *
 * @return {ILocalFileSourceProviderOptions}
 */
const getLocalFileSourceOptions = (opts) => {
  /**
   * @type {ILocalFileSourceProviderOptions}
   */
  const options = {
    file: { path: opts.file },
    compression: { enabled: !!opts.decompress },
    encryption: { enabled: !!opts.decrypt, key: opts.key },
  };

  return options;
};
