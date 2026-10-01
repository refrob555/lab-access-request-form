import optionsJson from '../config/options.json' with { type: 'json' };
import { parseOptions } from './options.js';

export const appOptions = parseOptions(JSON.stringify(optionsJson));
