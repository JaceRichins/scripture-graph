"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "../../node_modules/zod/v3/helpers/util.js"() {
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
          filtered[k] = obj[k];
        }
        return util2.objectValues(filtered);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = (data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data)) {
            return ZodParsedType.array;
          }
          if (data === null) {
            return ZodParsedType.null;
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    };
  }
});

// ../../node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "../../node_modules/zod/v3/ZodError.js"() {
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = (obj) => {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/"([^"]+)":/g, "$1:");
    };
    ZodError = class _ZodError extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
          for (const issue of error.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        };
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof _ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    ZodError.create = (issues) => {
      const error = new ZodError(issues);
      return error;
    };
  }
});

// ../../node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "../../node_modules/zod/v3/locales/en.js"() {
    init_ZodError();
    init_util();
    errorMap = (issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    };
    en_default = errorMap;
  }
});

// ../../node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm({
  "../../node_modules/zod/v3/errors.js"() {
    init_en();
    overrideErrorMap = en_default;
  }
});

// ../../node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "../../node_modules/zod/v3/helpers/parseUtil.js"() {
    init_errors();
    init_en();
    makeIssue = (params) => {
      const { data, path, errorMaps, issueData } = params;
      const fullPath = [...path, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    };
    EMPTY_PATH = [];
    ParseStatus = class _ParseStatus {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key, value } = pair;
          if (key.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = (value) => ({ status: "dirty", value });
    OK = (value) => ({ status: "valid", value });
    isAborted = (x) => x.status === "aborted";
    isDirty = (x) => x.status === "dirty";
    isValid = (x) => x.status === "valid";
    isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  }
});

// ../../node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "../../node_modules/zod/v3/helpers/typeAliases.js"() {
  }
});

// ../../node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "../../node_modules/zod/v3/helpers/errorUtil.js"() {
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// ../../node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types = __esm({
  "../../node_modules/zod/v3/types.js"() {
    init_ZodError();
    init_errors();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path;
        this._key = key;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    handleResult = (ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error = new ZodError(ctx.common.issues);
            this._error = error;
            return this._error;
          }
        };
      }
    };
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check, message) {
        const getIssueProperties = (val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        };
        return this._refinement((val, ctx) => {
          const result = check(val);
          const setError = () => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          });
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data) => {
              if (!data) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data) => this["~validate"](data)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    ZodString = class _ZodString extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.length < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.length > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "length") {
            const tooBig = input.data.length > check.value;
            const tooSmall = input.data.length < check.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              }
              status.dirty();
            }
          } else if (check.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "regex") {
            check.regex.lastIndex = 0;
            const testResult = check.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "trim") {
            input.data = input.data.trim();
          } else if (check.kind === "includes") {
            if (!input.data.includes(check.value, check.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check.value, position: check.position },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check.kind === "startsWith") {
            if (!input.data.startsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "endsWith") {
            if (!input.data.endsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "datetime") {
            const regex = datetimeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "time") {
            const regex = timeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ip") {
            if (!isValidIP(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "jwt") {
            if (!isValidJWT(input.data, check.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cidr") {
            if (!isValidCidr(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check) {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodNumber = class _ZodNumber extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class _ZodBigInt extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (input.data % check.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class _ZodDate extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.getTime() < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check.message,
                inclusive: true,
                exact: false,
                minimum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.getTime() > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check.message,
                inclusive: true,
                exact: false,
                maximum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check) {
        return new _ZodDate({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      min(minDate, message) {
        return this._addCheck({
          kind: "min",
          value: minDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class _ZodArray extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new _ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new _ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new _ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodArray.create = (schema, params) => {
      return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    ZodObject = class _ZodObject extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key in ctx.data) {
            if (!shapeKeys.includes(key)) {
              extraKeys.push(key);
            }
          }
        }
        const pairs = [];
        for (const key of shapeKeys) {
          const keyValidator = shape[key];
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key },
                value: { status: "valid", value: ctx.data[key] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key of extraKeys) {
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new _ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new _ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key, schema) {
        return this.augment({ [key]: schema });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index) {
        return new _ZodObject({
          ...this._def,
          catchall: index
        });
      }
      pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
          if (mask[key] && this.shape[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (!mask[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key];
          if (mask && !mask[key]) {
            newShape[key] = fieldSchema;
          } else {
            newShape[key] = fieldSchema.optional();
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (mask && !mask[key]) {
            newShape[key] = this.shape[key];
          } else {
            const fieldSchema = this.shape[key];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key] = newField;
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    ZodUnion.create = (types, params) => {
      return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = (type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    };
    ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new _ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class _ZodTuple extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema = this._def.items[itemIndex] || this._def.rest;
          if (!schema)
            return null;
          return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new _ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    ZodTuple.create = (schemas, params) => {
      if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class _ZodRecord extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new _ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new _ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key = pair.key;
            const value = pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class _ZodSet extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new _ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new _ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class _ZodFunction extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error
            }
          });
        }
        function makeReturnsIssue(returns, error) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error
            }
          });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new _ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new _ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new _ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    ZodEnum = class _ZodEnum extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return _ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    ZodPromise.create = (schema, params) => {
      return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = (acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          };
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    ZodEffects.create = (schema, effect, params) => {
      return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
      return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    ZodPipeline = class _ZodPipeline extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          };
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new _ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
          if (isValid(data)) {
            data.value = Object.freeze(data.value);
          }
          return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = (cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data) => data instanceof cls, params);
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = () => stringType().optional();
    onumber = () => numberType().optional();
    oboolean = () => booleanType().optional();
    coerce = {
      string: (arg) => ZodString.create({ ...arg, coerce: true }),
      number: (arg) => ZodNumber.create({ ...arg, coerce: true }),
      boolean: (arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      }),
      bigint: (arg) => ZodBigInt.create({ ...arg, coerce: true }),
      date: (arg) => ZodDate.create({ ...arg, coerce: true })
    };
    NEVER = INVALID;
  }
});

// ../../node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "../../node_modules/zod/v3/external.js"() {
    init_errors();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types();
    init_ZodError();
  }
});

// ../../node_modules/zod/index.js
var init_zod = __esm({
  "../../node_modules/zod/index.js"() {
    init_external();
    init_external();
  }
});

// ../../packages/core-sdk/src/schemas.ts
var AnnotationType, Visibility, AnchorType, SyncState, Annotation, User, Group, Membership, Invite, SyncOpKind, SyncOp, SyncPushResult, AuditEvent, ClaimRequest, SessionInfo;
var init_schemas = __esm({
  "../../packages/core-sdk/src/schemas.ts"() {
    "use strict";
    init_zod();
    AnnotationType = external_exports.enum([
      "highlight",
      "note",
      "question",
      "bookmark",
      "reaction",
      "study-marker"
    ]);
    Visibility = external_exports.enum(["local", "private", "group", "public"]);
    AnchorType = external_exports.enum(["verse", "chapter", "node"]);
    SyncState = external_exports.enum(["local_only", "pending_sync", "synced", "conflict"]);
    Annotation = external_exports.object({
      annotation_id: external_exports.string().uuid(),
      author_user_id: external_exports.string().uuid().nullable(),
      // null while local-only/unclaimed
      anchor_type: AnchorType,
      /** verse: "alma-36-18" · chapter: "alma-36" · node: sg-id like "topic:faith" */
      anchor_id: external_exports.string().min(2).max(200),
      annotation_type: AnnotationType,
      /** partial-verse anchoring (§9); null = whole verse/node */
      selected_text: external_exports.string().max(2e3).nullable().default(null),
      start_offset: external_exports.number().int().min(0).nullable().default(null),
      end_offset: external_exports.number().int().min(0).nullable().default(null),
      text_hash: external_exports.string().max(16).nullable().default(null),
      /** note body / question text; empty for pure highlights */
      content: external_exports.string().max(2e4).default(""),
      color: external_exports.string().max(20).nullable().default(null),
      /** text treatment: highlight (bg) | underline | bold | italic — null = highlight */
      style: external_exports.string().max(20).nullable().default(null),
      /** user-named theme this mark belongs to ("Faith", "Covenants", …) */
      theme: external_exports.string().max(60).nullable().default(null),
      visibility: Visibility,
      group_id: external_exports.string().uuid().nullable().default(null),
      created_at: external_exports.string(),
      updated_at: external_exports.string(),
      deleted_at: external_exports.string().nullable().default(null),
      version: external_exports.number().int().min(1).default(1)
    });
    User = external_exports.object({
      user_id: external_exports.string().uuid(),
      display_name: external_exports.string().min(1).max(80),
      role: external_exports.enum(["owner", "member"]).default("member"),
      created_at: external_exports.string()
    });
    Group = external_exports.object({
      group_id: external_exports.string().uuid(),
      name: external_exports.string().min(1).max(80),
      owner_user_id: external_exports.string().uuid(),
      created_at: external_exports.string()
    });
    Membership = external_exports.object({
      group_id: external_exports.string().uuid(),
      user_id: external_exports.string().uuid(),
      role: external_exports.enum(["admin", "member"]),
      joined_at: external_exports.string()
    });
    Invite = external_exports.object({
      code: external_exports.string().min(8).max(24),
      kind: external_exports.enum(["account", "group"]),
      group_id: external_exports.string().uuid().nullable(),
      max_uses: external_exports.number().int().min(1),
      uses: external_exports.number().int().min(0),
      expires_at: external_exports.string(),
      created_by: external_exports.string().uuid()
    });
    SyncOpKind = external_exports.enum(["upsert_annotation", "delete_annotation"]);
    SyncOp = external_exports.object({
      op_id: external_exports.string().uuid(),
      // client-generated; server idempotency key
      kind: SyncOpKind,
      annotation: Annotation,
      base_version: external_exports.number().int().min(0),
      // version the client last saw (0 = new)
      queued_at: external_exports.string()
    });
    SyncPushResult = external_exports.object({
      op_id: external_exports.string().uuid(),
      status: external_exports.enum(["applied", "duplicate", "conflict", "rejected"]),
      server_annotation: Annotation.nullable(),
      reason: external_exports.string().optional()
    });
    AuditEvent = external_exports.object({
      event_id: external_exports.number().int(),
      at: external_exports.string(),
      actor_user_id: external_exports.string().uuid(),
      action: external_exports.string(),
      entity: external_exports.string(),
      entity_id: external_exports.string(),
      detail: external_exports.string().nullable()
    });
    ClaimRequest = external_exports.object({
      invite_code: external_exports.string().min(4).max(64),
      display_name: external_exports.string().min(1).max(80),
      device_name: external_exports.string().min(1).max(120)
    });
    SessionInfo = external_exports.object({
      user: User,
      device_id: external_exports.string().uuid(),
      token: external_exports.string().min(32)
    });
  }
});

// ../../packages/core-sdk/src/books.json
var books_default;
var init_books = __esm({
  "../../packages/core-sdk/src/books.json"() {
    books_default = [
      {
        name: "Genesis",
        slug: "gen",
        prefix: "Genesis",
        volume: "Old Testament",
        chapters: 50,
        aliases: [
          "Gen."
        ],
        volumeSeq: 1,
        bookSeq: 1
      },
      {
        name: "Exodus",
        slug: "ex",
        prefix: "Exodus",
        volume: "Old Testament",
        chapters: 40,
        aliases: [
          "Ex.",
          "Exod."
        ],
        volumeSeq: 1,
        bookSeq: 2
      },
      {
        name: "Leviticus",
        slug: "lev",
        prefix: "Leviticus",
        volume: "Old Testament",
        chapters: 27,
        aliases: [
          "Lev."
        ],
        volumeSeq: 1,
        bookSeq: 3
      },
      {
        name: "Numbers",
        slug: "num",
        prefix: "Numbers",
        volume: "Old Testament",
        chapters: 36,
        aliases: [
          "Num."
        ],
        volumeSeq: 1,
        bookSeq: 4
      },
      {
        name: "Deuteronomy",
        slug: "deut",
        prefix: "Deuteronomy",
        volume: "Old Testament",
        chapters: 34,
        aliases: [
          "Deut."
        ],
        volumeSeq: 1,
        bookSeq: 5
      },
      {
        name: "Joshua",
        slug: "josh",
        prefix: "Joshua",
        volume: "Old Testament",
        chapters: 24,
        aliases: [
          "Josh."
        ],
        volumeSeq: 1,
        bookSeq: 6
      },
      {
        name: "Judges",
        slug: "judg",
        prefix: "Judges",
        volume: "Old Testament",
        chapters: 21,
        aliases: [
          "Judg."
        ],
        volumeSeq: 1,
        bookSeq: 7
      },
      {
        name: "Ruth",
        slug: "ruth",
        prefix: "Ruth",
        volume: "Old Testament",
        chapters: 4,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 8
      },
      {
        name: "1 Samuel",
        slug: "1sam",
        prefix: "1 Samuel",
        volume: "Old Testament",
        chapters: 31,
        aliases: [
          "1 Sam."
        ],
        volumeSeq: 1,
        bookSeq: 9
      },
      {
        name: "2 Samuel",
        slug: "2sam",
        prefix: "2 Samuel",
        volume: "Old Testament",
        chapters: 24,
        aliases: [
          "2 Sam."
        ],
        volumeSeq: 1,
        bookSeq: 10
      },
      {
        name: "1 Kings",
        slug: "1kgs",
        prefix: "1 Kings",
        volume: "Old Testament",
        chapters: 22,
        aliases: [
          "1 Kgs."
        ],
        volumeSeq: 1,
        bookSeq: 11
      },
      {
        name: "2 Kings",
        slug: "2kgs",
        prefix: "2 Kings",
        volume: "Old Testament",
        chapters: 25,
        aliases: [
          "2 Kgs."
        ],
        volumeSeq: 1,
        bookSeq: 12
      },
      {
        name: "1 Chronicles",
        slug: "1chr",
        prefix: "1 Chronicles",
        volume: "Old Testament",
        chapters: 29,
        aliases: [
          "1 Chr.",
          "1 Chron."
        ],
        volumeSeq: 1,
        bookSeq: 13
      },
      {
        name: "2 Chronicles",
        slug: "2chr",
        prefix: "2 Chronicles",
        volume: "Old Testament",
        chapters: 36,
        aliases: [
          "2 Chr.",
          "2 Chron."
        ],
        volumeSeq: 1,
        bookSeq: 14
      },
      {
        name: "Ezra",
        slug: "ezra",
        prefix: "Ezra",
        volume: "Old Testament",
        chapters: 10,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 15
      },
      {
        name: "Nehemiah",
        slug: "neh",
        prefix: "Nehemiah",
        volume: "Old Testament",
        chapters: 13,
        aliases: [
          "Neh."
        ],
        volumeSeq: 1,
        bookSeq: 16
      },
      {
        name: "Esther",
        slug: "esth",
        prefix: "Esther",
        volume: "Old Testament",
        chapters: 10,
        aliases: [
          "Esth."
        ],
        volumeSeq: 1,
        bookSeq: 17
      },
      {
        name: "Job",
        slug: "job",
        prefix: "Job",
        volume: "Old Testament",
        chapters: 42,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 18
      },
      {
        name: "Psalms",
        slug: "ps",
        prefix: "Psalm",
        volume: "Old Testament",
        chapters: 150,
        aliases: [
          "Psalm",
          "Ps.",
          "Pss."
        ],
        volumeSeq: 1,
        bookSeq: 19
      },
      {
        name: "Proverbs",
        slug: "prov",
        prefix: "Proverbs",
        volume: "Old Testament",
        chapters: 31,
        aliases: [
          "Prov."
        ],
        volumeSeq: 1,
        bookSeq: 20
      },
      {
        name: "Ecclesiastes",
        slug: "eccl",
        prefix: "Ecclesiastes",
        volume: "Old Testament",
        chapters: 12,
        aliases: [
          "Eccl."
        ],
        volumeSeq: 1,
        bookSeq: 21
      },
      {
        name: "Song of Solomon",
        slug: "song",
        prefix: "Song of Solomon",
        volume: "Old Testament",
        chapters: 8,
        aliases: [
          "Song of Sol."
        ],
        volumeSeq: 1,
        bookSeq: 22
      },
      {
        name: "Isaiah",
        slug: "isa",
        prefix: "Isaiah",
        volume: "Old Testament",
        chapters: 66,
        aliases: [
          "Isa."
        ],
        volumeSeq: 1,
        bookSeq: 23
      },
      {
        name: "Jeremiah",
        slug: "jer",
        prefix: "Jeremiah",
        volume: "Old Testament",
        chapters: 52,
        aliases: [
          "Jer."
        ],
        volumeSeq: 1,
        bookSeq: 24
      },
      {
        name: "Lamentations",
        slug: "lam",
        prefix: "Lamentations",
        volume: "Old Testament",
        chapters: 5,
        aliases: [
          "Lam."
        ],
        volumeSeq: 1,
        bookSeq: 25
      },
      {
        name: "Ezekiel",
        slug: "ezek",
        prefix: "Ezekiel",
        volume: "Old Testament",
        chapters: 48,
        aliases: [
          "Ezek."
        ],
        volumeSeq: 1,
        bookSeq: 26
      },
      {
        name: "Daniel",
        slug: "dan",
        prefix: "Daniel",
        volume: "Old Testament",
        chapters: 12,
        aliases: [
          "Dan."
        ],
        volumeSeq: 1,
        bookSeq: 27
      },
      {
        name: "Hosea",
        slug: "hosea",
        prefix: "Hosea",
        volume: "Old Testament",
        chapters: 14,
        aliases: [
          "Hos."
        ],
        volumeSeq: 1,
        bookSeq: 28
      },
      {
        name: "Joel",
        slug: "joel",
        prefix: "Joel",
        volume: "Old Testament",
        chapters: 3,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 29
      },
      {
        name: "Amos",
        slug: "amos",
        prefix: "Amos",
        volume: "Old Testament",
        chapters: 9,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 30
      },
      {
        name: "Obadiah",
        slug: "obad",
        prefix: "Obadiah",
        volume: "Old Testament",
        chapters: 1,
        aliases: [
          "Obad."
        ],
        volumeSeq: 1,
        bookSeq: 31
      },
      {
        name: "Jonah",
        slug: "jonah",
        prefix: "Jonah",
        volume: "Old Testament",
        chapters: 4,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 32
      },
      {
        name: "Micah",
        slug: "micah",
        prefix: "Micah",
        volume: "Old Testament",
        chapters: 7,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 33
      },
      {
        name: "Nahum",
        slug: "nahum",
        prefix: "Nahum",
        volume: "Old Testament",
        chapters: 3,
        aliases: [],
        volumeSeq: 1,
        bookSeq: 34
      },
      {
        name: "Habakkuk",
        slug: "hab",
        prefix: "Habakkuk",
        volume: "Old Testament",
        chapters: 3,
        aliases: [
          "Hab."
        ],
        volumeSeq: 1,
        bookSeq: 35
      },
      {
        name: "Zephaniah",
        slug: "zeph",
        prefix: "Zephaniah",
        volume: "Old Testament",
        chapters: 3,
        aliases: [
          "Zeph."
        ],
        volumeSeq: 1,
        bookSeq: 36
      },
      {
        name: "Haggai",
        slug: "hag",
        prefix: "Haggai",
        volume: "Old Testament",
        chapters: 2,
        aliases: [
          "Hag."
        ],
        volumeSeq: 1,
        bookSeq: 37
      },
      {
        name: "Zechariah",
        slug: "zech",
        prefix: "Zechariah",
        volume: "Old Testament",
        chapters: 14,
        aliases: [
          "Zech."
        ],
        volumeSeq: 1,
        bookSeq: 38
      },
      {
        name: "Malachi",
        slug: "mal",
        prefix: "Malachi",
        volume: "Old Testament",
        chapters: 4,
        aliases: [
          "Mal."
        ],
        volumeSeq: 1,
        bookSeq: 39
      },
      {
        name: "Matthew",
        slug: "matt",
        prefix: "Matthew",
        volume: "New Testament",
        chapters: 28,
        aliases: [
          "Matt."
        ],
        volumeSeq: 2,
        bookSeq: 1
      },
      {
        name: "Mark",
        slug: "mark",
        prefix: "Mark",
        volume: "New Testament",
        chapters: 16,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 2
      },
      {
        name: "Luke",
        slug: "luke",
        prefix: "Luke",
        volume: "New Testament",
        chapters: 24,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 3
      },
      {
        name: "John",
        slug: "john",
        prefix: "John",
        volume: "New Testament",
        chapters: 21,
        aliases: [
          "Jn."
        ],
        volumeSeq: 2,
        bookSeq: 4
      },
      {
        name: "Acts",
        slug: "acts",
        prefix: "Acts",
        volume: "New Testament",
        chapters: 28,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 5
      },
      {
        name: "Romans",
        slug: "rom",
        prefix: "Romans",
        volume: "New Testament",
        chapters: 16,
        aliases: [
          "Rom."
        ],
        volumeSeq: 2,
        bookSeq: 6
      },
      {
        name: "1 Corinthians",
        slug: "1cor",
        prefix: "1 Corinthians",
        volume: "New Testament",
        chapters: 16,
        aliases: [
          "1 Cor."
        ],
        volumeSeq: 2,
        bookSeq: 7
      },
      {
        name: "2 Corinthians",
        slug: "2cor",
        prefix: "2 Corinthians",
        volume: "New Testament",
        chapters: 13,
        aliases: [
          "2 Cor."
        ],
        volumeSeq: 2,
        bookSeq: 8
      },
      {
        name: "Galatians",
        slug: "gal",
        prefix: "Galatians",
        volume: "New Testament",
        chapters: 6,
        aliases: [
          "Gal."
        ],
        volumeSeq: 2,
        bookSeq: 9
      },
      {
        name: "Ephesians",
        slug: "eph",
        prefix: "Ephesians",
        volume: "New Testament",
        chapters: 6,
        aliases: [
          "Eph."
        ],
        volumeSeq: 2,
        bookSeq: 10
      },
      {
        name: "Philippians",
        slug: "philip",
        prefix: "Philippians",
        volume: "New Testament",
        chapters: 4,
        aliases: [
          "Philip.",
          "Phil."
        ],
        volumeSeq: 2,
        bookSeq: 11
      },
      {
        name: "Colossians",
        slug: "col",
        prefix: "Colossians",
        volume: "New Testament",
        chapters: 4,
        aliases: [
          "Col."
        ],
        volumeSeq: 2,
        bookSeq: 12
      },
      {
        name: "1 Thessalonians",
        slug: "1thes",
        prefix: "1 Thessalonians",
        volume: "New Testament",
        chapters: 5,
        aliases: [
          "1 Thes.",
          "1 Thess."
        ],
        volumeSeq: 2,
        bookSeq: 13
      },
      {
        name: "2 Thessalonians",
        slug: "2thes",
        prefix: "2 Thessalonians",
        volume: "New Testament",
        chapters: 3,
        aliases: [
          "2 Thes.",
          "2 Thess."
        ],
        volumeSeq: 2,
        bookSeq: 14
      },
      {
        name: "1 Timothy",
        slug: "1tim",
        prefix: "1 Timothy",
        volume: "New Testament",
        chapters: 6,
        aliases: [
          "1 Tim."
        ],
        volumeSeq: 2,
        bookSeq: 15
      },
      {
        name: "2 Timothy",
        slug: "2tim",
        prefix: "2 Timothy",
        volume: "New Testament",
        chapters: 4,
        aliases: [
          "2 Tim."
        ],
        volumeSeq: 2,
        bookSeq: 16
      },
      {
        name: "Titus",
        slug: "titus",
        prefix: "Titus",
        volume: "New Testament",
        chapters: 3,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 17
      },
      {
        name: "Philemon",
        slug: "philem",
        prefix: "Philemon",
        volume: "New Testament",
        chapters: 1,
        aliases: [
          "Philem."
        ],
        volumeSeq: 2,
        bookSeq: 18
      },
      {
        name: "Hebrews",
        slug: "heb",
        prefix: "Hebrews",
        volume: "New Testament",
        chapters: 13,
        aliases: [
          "Heb."
        ],
        volumeSeq: 2,
        bookSeq: 19
      },
      {
        name: "James",
        slug: "james",
        prefix: "James",
        volume: "New Testament",
        chapters: 5,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 20
      },
      {
        name: "1 Peter",
        slug: "1pet",
        prefix: "1 Peter",
        volume: "New Testament",
        chapters: 5,
        aliases: [
          "1 Pet."
        ],
        volumeSeq: 2,
        bookSeq: 21
      },
      {
        name: "2 Peter",
        slug: "2pet",
        prefix: "2 Peter",
        volume: "New Testament",
        chapters: 3,
        aliases: [
          "2 Pet."
        ],
        volumeSeq: 2,
        bookSeq: 22
      },
      {
        name: "1 John",
        slug: "1jn",
        prefix: "1 John",
        volume: "New Testament",
        chapters: 5,
        aliases: [
          "1 Jn."
        ],
        volumeSeq: 2,
        bookSeq: 23
      },
      {
        name: "2 John",
        slug: "2jn",
        prefix: "2 John",
        volume: "New Testament",
        chapters: 1,
        aliases: [
          "2 Jn."
        ],
        volumeSeq: 2,
        bookSeq: 24
      },
      {
        name: "3 John",
        slug: "3jn",
        prefix: "3 John",
        volume: "New Testament",
        chapters: 1,
        aliases: [
          "3 Jn."
        ],
        volumeSeq: 2,
        bookSeq: 25
      },
      {
        name: "Jude",
        slug: "jude",
        prefix: "Jude",
        volume: "New Testament",
        chapters: 1,
        aliases: [],
        volumeSeq: 2,
        bookSeq: 26
      },
      {
        name: "Revelation",
        slug: "rev",
        prefix: "Revelation",
        volume: "New Testament",
        chapters: 22,
        aliases: [
          "Rev.",
          "Revelations"
        ],
        volumeSeq: 2,
        bookSeq: 27
      },
      {
        name: "1 Nephi",
        slug: "1ne",
        prefix: "1 Nephi",
        volume: "Book of Mormon",
        chapters: 22,
        aliases: [
          "1 Ne."
        ],
        volumeSeq: 3,
        bookSeq: 1
      },
      {
        name: "2 Nephi",
        slug: "2ne",
        prefix: "2 Nephi",
        volume: "Book of Mormon",
        chapters: 33,
        aliases: [
          "2 Ne."
        ],
        volumeSeq: 3,
        bookSeq: 2
      },
      {
        name: "Jacob",
        slug: "jacob",
        prefix: "Jacob",
        volume: "Book of Mormon",
        chapters: 7,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 3
      },
      {
        name: "Enos",
        slug: "enos",
        prefix: "Enos",
        volume: "Book of Mormon",
        chapters: 1,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 4
      },
      {
        name: "Jarom",
        slug: "jarom",
        prefix: "Jarom",
        volume: "Book of Mormon",
        chapters: 1,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 5
      },
      {
        name: "Omni",
        slug: "omni",
        prefix: "Omni",
        volume: "Book of Mormon",
        chapters: 1,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 6
      },
      {
        name: "Words of Mormon",
        slug: "wofm",
        prefix: "Words of Mormon",
        volume: "Book of Mormon",
        chapters: 1,
        aliases: [
          "W of M",
          "WofM"
        ],
        volumeSeq: 3,
        bookSeq: 7
      },
      {
        name: "Mosiah",
        slug: "mosiah",
        prefix: "Mosiah",
        volume: "Book of Mormon",
        chapters: 29,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 8
      },
      {
        name: "Alma",
        slug: "alma",
        prefix: "Alma",
        volume: "Book of Mormon",
        chapters: 63,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 9
      },
      {
        name: "Helaman",
        slug: "hel",
        prefix: "Helaman",
        volume: "Book of Mormon",
        chapters: 16,
        aliases: [
          "Hel."
        ],
        volumeSeq: 3,
        bookSeq: 10
      },
      {
        name: "3 Nephi",
        slug: "3ne",
        prefix: "3 Nephi",
        volume: "Book of Mormon",
        chapters: 30,
        aliases: [
          "3 Ne."
        ],
        volumeSeq: 3,
        bookSeq: 11
      },
      {
        name: "4 Nephi",
        slug: "4ne",
        prefix: "4 Nephi",
        volume: "Book of Mormon",
        chapters: 1,
        aliases: [
          "4 Ne."
        ],
        volumeSeq: 3,
        bookSeq: 12
      },
      {
        name: "Mormon",
        slug: "morm",
        prefix: "Mormon",
        volume: "Book of Mormon",
        chapters: 9,
        aliases: [
          "Morm."
        ],
        volumeSeq: 3,
        bookSeq: 13
      },
      {
        name: "Ether",
        slug: "ether",
        prefix: "Ether",
        volume: "Book of Mormon",
        chapters: 15,
        aliases: [],
        volumeSeq: 3,
        bookSeq: 14
      },
      {
        name: "Moroni",
        slug: "moro",
        prefix: "Moroni",
        volume: "Book of Mormon",
        chapters: 10,
        aliases: [
          "Moro."
        ],
        volumeSeq: 3,
        bookSeq: 15
      },
      {
        name: "Doctrine and Covenants",
        slug: "dc",
        prefix: "D&C",
        volume: "Doctrine and Covenants",
        chapters: 138,
        aliases: [
          "D&C",
          "D & C",
          "Doctrine & Covenants"
        ],
        volumeSeq: 4,
        bookSeq: 1
      },
      {
        name: "Official Declarations",
        slug: "od",
        prefix: "Official Declaration",
        volume: "Doctrine and Covenants",
        chapters: 2,
        aliases: [
          "OD",
          "Official Declaration"
        ],
        volumeSeq: 4,
        bookSeq: 2
      },
      {
        name: "Moses",
        slug: "moses",
        prefix: "Moses",
        volume: "Pearl of Great Price",
        chapters: 8,
        aliases: [],
        volumeSeq: 5,
        bookSeq: 1
      },
      {
        name: "Abraham",
        slug: "abr",
        prefix: "Abraham",
        volume: "Pearl of Great Price",
        chapters: 5,
        aliases: [
          "Abr."
        ],
        volumeSeq: 5,
        bookSeq: 2
      },
      {
        name: "Joseph Smith\u2014Matthew",
        slug: "jsm",
        prefix: "Joseph Smith\u2014Matthew",
        volume: "Pearl of Great Price",
        chapters: 1,
        aliases: [
          "Joseph Smith-Matthew",
          "JS-Matthew",
          "JS-M"
        ],
        volumeSeq: 5,
        bookSeq: 3
      },
      {
        name: "Joseph Smith\u2014History",
        slug: "jsh",
        prefix: "Joseph Smith\u2014History",
        volume: "Pearl of Great Price",
        chapters: 1,
        aliases: [
          "Joseph Smith-History",
          "JS-History",
          "JS-H"
        ],
        volumeSeq: 5,
        bookSeq: 4
      },
      {
        name: "Articles of Faith",
        slug: "aoff",
        prefix: "Articles of Faith",
        volume: "Pearl of Great Price",
        chapters: 1,
        aliases: [
          "A of F",
          "AofF"
        ],
        volumeSeq: 5,
        bookSeq: 5
      }
    ];
  }
});

// ../../packages/core-sdk/src/anchors.ts
function parseVerseId(id) {
  const i = id.lastIndexOf("-");
  const j = id.lastIndexOf("-", i - 1);
  if (i < 0 || j < 0) return null;
  const bookSlug = id.slice(0, j);
  const chapter = Number(id.slice(j + 1, i));
  const verse = Number(id.slice(i + 1));
  if (!BOOK_BY_SLUG.has(bookSlug) || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
  if (chapter < 1 || verse < 1) return null;
  return { bookSlug, chapter, verse };
}
function chapterTitle(bookSlug, chapter) {
  const b = BOOK_BY_SLUG.get(bookSlug);
  return b ? `${b.prefix} ${chapter}` : null;
}
function verseDisplay(verseId) {
  const r = parseVerseId(verseId);
  if (!r) return null;
  return `${chapterTitle(r.bookSlug, r.chapter)}:${r.verse}`;
}
function chapterIdFromTitle(title) {
  const m = /^(.+?)\s+(\d{1,3})$/.exec(title.trim());
  if (!m) return null;
  const b = ALIAS_MAP.get(m[1].replace(/[—–]/g, "-"));
  return b ? `${b.slug}-${Number(m[2])}` : null;
}
function findScriptureRefs(text) {
  const norm = text.replace(/[—–‑]/g, "-");
  const out = [];
  for (const m of norm.matchAll(REF_RE)) {
    const book = ALIAS_MAP.get(m[1]);
    if (!book) continue;
    const chapter = Number(m[2]);
    if (chapter < 1 || chapter > book.chapters) continue;
    const verses = [];
    const vs = (m[3] ?? "").replace(/\s+/g, "");
    const vm = /^:(\d{1,3})(?:-(\d{1,3}))?$/.exec(vs);
    if (vm) {
      const a = Number(vm[1]);
      const b = vm[2] ? Number(vm[2]) : a;
      for (let v = a; v <= Math.min(b, a + 200); v++) verses.push(v);
    }
    out.push({ bookSlug: book.slug, chapter, verses, text: text.slice(m.index, m.index + m[0].length), index: m.index });
  }
  return out;
}
function textHash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function makePartialAnchor(verseText, selected) {
  const sel = selected.trim();
  if (sel.length < 1) return null;
  const idx = verseText.indexOf(sel);
  if (idx < 0) return null;
  return {
    selected_text: sel,
    start_offset: idx,
    end_offset: idx + sel.length,
    text_hash: textHash(verseText)
  };
}
var BOOKS, BOOK_BY_SLUG, ALIAS_MAP, ALIAS_ALT, REF_RE;
var init_anchors = __esm({
  "../../packages/core-sdk/src/anchors.ts"() {
    "use strict";
    init_books();
    BOOKS = books_default;
    BOOK_BY_SLUG = new Map(BOOKS.map((b) => [b.slug, b]));
    ALIAS_MAP = (() => {
      const m = /* @__PURE__ */ new Map();
      for (const b of BOOKS) {
        const forms = /* @__PURE__ */ new Set([b.name, b.prefix, ...b.aliases]);
        for (const raw of forms) {
          const f = raw.replace(/[—–]/g, "-");
          m.set(f, b);
          if (f.endsWith(".")) m.set(f.slice(0, -1), b);
        }
      }
      return m;
    })();
    ALIAS_ALT = [...ALIAS_MAP.keys()].sort((a, b) => b.length - a.length).map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    REF_RE = new RegExp(
      `(?<![A-Za-z])(${ALIAS_ALT})[ \\u00a0]+(\\d{1,3})(?!\\d)((?:\\s*:\\s*\\d{1,3}(?:\\s*-\\s*\\d{1,3})?)?)`,
      "g"
    );
  }
});

// ../../packages/core-sdk/src/localstore.ts
var WebStorage;
var init_localstore = __esm({
  "../../packages/core-sdk/src/localstore.ts"() {
    "use strict";
    WebStorage = class {
      constructor(ns, storage) {
        this.ns = ns;
        this.storage = storage;
      }
      k(key) {
        return `${this.ns}:${key}`;
      }
      async get(key) {
        try {
          const v = this.storage.getItem(this.k(key));
          return v === null ? null : JSON.parse(v);
        } catch {
          return null;
        }
      }
      async put(key, value) {
        this.storage.setItem(this.k(key), JSON.stringify(value));
      }
      async delete(key) {
        this.storage.removeItem(this.k(key));
      }
      async keys(prefix) {
        const out = [];
        const full = this.k(prefix);
        for (let i = 0; i < this.storage.length; i++) {
          const k = this.storage.key(i);
          if (k && k.startsWith(full)) out.push(k.slice(this.ns.length + 1));
        }
        return out;
      }
    };
  }
});

// ../../packages/core-sdk/src/api.ts
var ApiError, ApiClient;
var init_api = __esm({
  "../../packages/core-sdk/src/api.ts"() {
    "use strict";
    ApiError = class extends Error {
      constructor(status, message) {
        super(message);
        this.status = status;
      }
    };
    ApiClient = class {
      constructor(baseUrl, fetchFn, token = null) {
        this.baseUrl = baseUrl;
        this.fetchFn = fetchFn;
        this.token = token;
      }
      setToken(t) {
        this.token = t;
      }
      async req(method, path, body) {
        const headers = { "content-type": "application/json" };
        if (this.token) headers["authorization"] = `Bearer ${this.token}`;
        const res = await this.fetchFn(this.baseUrl.replace(/\/$/, "") + path, {
          method,
          headers,
          body: body === void 0 ? void 0 : JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        if (res.status >= 400) {
          throw new ApiError(res.status, String(data.error ?? `HTTP ${res.status}`));
        }
        return data;
      }
      // auth
      claim(invite_code, display_name, device_name) {
        return this.req("POST", "/auth/claim", { invite_code, display_name, device_name });
      }
      linkDevice(link_code, device_name) {
        return this.req("POST", "/auth/link-device", { link_code, device_name });
      }
      me() {
        return this.req("GET", "/me");
      }
      logoutDevice() {
        return this.req("POST", "/auth/logout");
      }
      // groups
      createGroup(name) {
        return this.req("POST", "/groups", { name });
      }
      listGroups() {
        return this.req("GET", "/groups");
      }
      createGroupInvite(group_id, max_uses = 10, ttl_hours = 24 * 14) {
        return this.req("POST", `/groups/${group_id}/invites`, { max_uses, ttl_hours });
      }
      createAccountInvite(max_uses = 1, ttl_hours = 24 * 14) {
        return this.req("POST", "/invites/account", { max_uses, ttl_hours });
      }
      createAccountInviteDeviceLink() {
        return this.req("POST", "/invites/account", { device_link: true });
      }
      acceptInvite(code) {
        return this.req("POST", "/invites/accept", { code });
      }
      leaveGroup(group_id) {
        return this.req("POST", `/groups/${group_id}/leave`);
      }
      removeMember(group_id, user_id) {
        return this.req("DELETE", `/groups/${group_id}/members/${user_id}`);
      }
      groupMembers(group_id) {
        return this.req("GET", `/groups/${group_id}/members`);
      }
      // sync + annotations
      syncPush(ops) {
        return this.req("POST", "/sync/push", { ops });
      }
      syncPull(cursor) {
        return this.req(
          "GET",
          `/sync/pull?cursor=${encodeURIComponent(cursor ?? "")}`
        );
      }
      annotationsFor(anchorIds) {
        return this.req(
          "POST",
          "/annotations/query",
          { anchor_ids: anchorIds }
        );
      }
      // data portability
      exportMyData() {
        return this.req("GET", "/export");
      }
      deleteAccount() {
        return this.req("POST", "/account/delete");
      }
      // owner admin (content-free counters)
      adminOverview() {
        return this.req("GET", "/admin/overview");
      }
    };
  }
});

// ../../packages/core-sdk/src/syncengine.ts
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function uuid() {
  return globalThis.crypto.randomUUID();
}
var Q, A, SV, CURSOR, MAX_PUSH, SyncEngine;
var init_syncengine = __esm({
  "../../packages/core-sdk/src/syncengine.ts"() {
    "use strict";
    Q = "syncq/";
    A = "ann/";
    SV = "sv/";
    CURSOR = "sync_cursor";
    MAX_PUSH = 180;
    SyncEngine = class {
      constructor(store) {
        this.store = store;
      }
      /** same-millisecond ops still sort in exact creation order */
      opSeq = 0;
      stamp() {
        return `${nowIso()}~${(this.opSeq++).toString().padStart(6, "0")}`;
      }
      // ---------------------------------------------------------- local reads
      async getAnnotation(id) {
        return this.store.get(A + id);
      }
      async allAnnotations() {
        const keys = await this.store.keys(A);
        const out = [];
        for (const k of keys) {
          const a = await this.store.get(k);
          if (a && !a.deleted_at) out.push(a);
        }
        return out;
      }
      async annotationsForAnchor(anchorId) {
        return (await this.allAnnotations()).filter((a) => a.anchor_id === anchorId);
      }
      async serverVersion(id) {
        return this.store.get(SV + id);
      }
      async setServerVersion(id, v) {
        await this.store.put(SV + id, v);
      }
      // --------------------------------------------------------- local writes
      /** Save locally and (unless visibility=local) enqueue for the backend. */
      async save(a) {
        await this.store.put(A + a.annotation_id, a);
        if (a.visibility === "local") return;
        const sv = await this.serverVersion(a.annotation_id);
        const op = {
          op_id: uuid(),
          kind: a.deleted_at ? "delete_annotation" : "upsert_annotation",
          annotation: a,
          // the base is what the SERVER last confirmed — 0 only for never-synced
          base_version: sv ?? (a.deleted_at ? a.version : 0),
          queued_at: this.stamp()
        };
        await this.store.put(Q + op.op_id, op);
      }
      async softDelete(id) {
        const a = await this.getAnnotation(id);
        if (!a) return;
        const dead = { ...a, deleted_at: nowIso(), updated_at: nowIso() };
        await this.store.put(A + id, dead);
        if (a.visibility !== "local") {
          const sv = await this.serverVersion(id);
          const op = {
            op_id: uuid(),
            kind: "delete_annotation",
            annotation: dead,
            base_version: sv ?? a.version,
            queued_at: this.stamp()
          };
          await this.store.put(Q + op.op_id, op);
        }
      }
      async pendingCount() {
        return (await this.store.keys(Q)).length;
      }
      // ---------------------------------------------------------------- push
      async flush(api) {
        const keys = await this.store.keys(Q);
        const stats = { applied: 0, conflicts: 0, failed: 0 };
        if (!keys.length) return stats;
        const all = [];
        for (const k of keys) {
          const op = await this.store.get(k);
          if (op) all.push(op);
        }
        all.sort((x, y) => x.queued_at.localeCompare(y.queued_at) || x.op_id.localeCompare(y.op_id));
        const ops = all.slice(0, MAX_PUSH);
        let results;
        try {
          results = (await api.syncPush(ops)).results;
        } catch {
          stats.failed = ops.length;
          return stats;
        }
        for (const r of results) {
          const op = ops.find((o) => o.op_id === r.op_id);
          if (!op) continue;
          if (r.status === "applied" || r.status === "duplicate") {
            if (r.server_annotation) {
              await this.store.put(A + r.server_annotation.annotation_id, r.server_annotation);
              await this.setServerVersion(
                r.server_annotation.annotation_id,
                r.server_annotation.version
              );
            }
            await this.store.delete(Q + r.op_id);
            stats.applied++;
          } else if (r.status === "conflict") {
            if (r.server_annotation) {
              const local = op.annotation;
              await this.store.put(A + r.server_annotation.annotation_id, r.server_annotation);
              await this.setServerVersion(
                r.server_annotation.annotation_id,
                r.server_annotation.version
              );
              if (op.kind === "delete_annotation") {
                await this.softDelete(r.server_annotation.annotation_id);
              } else if (local.content && local.content !== r.server_annotation.content) {
                const copy = {
                  ...local,
                  annotation_id: uuid(),
                  annotation_type: "note",
                  visibility: "private",
                  content: `\u26A0 Conflict copy (kept so nothing is lost):

${local.content}`,
                  version: 1,
                  created_at: nowIso(),
                  updated_at: nowIso(),
                  deleted_at: null
                };
                await this.save(copy);
              }
            }
            await this.store.delete(Q + r.op_id);
            stats.conflicts++;
          } else {
            await this.store.delete(Q + r.op_id);
            stats.failed++;
          }
        }
        return stats;
      }
      // ---------------------------------------------------------------- pull
      async pull(api) {
        const cursor = await this.store.get(CURSOR);
        const res = await api.syncPull(cursor);
        for (const a of res.annotations) {
          const localKey = A + a.annotation_id;
          await this.setServerVersion(a.annotation_id, a.version);
          const local = await this.store.get(localKey);
          if (local && local.version >= a.version && !a.deleted_at) continue;
          await this.store.put(localKey, a);
        }
        await this.store.put(CURSOR, res.next_cursor);
        return res.annotations.length;
      }
    };
  }
});

// ../../packages/core-sdk/src/markdown.ts
function parseFrontmatter(text) {
  if (text.startsWith("---\n")) {
    const end = text.indexOf("\n---\n", 4);
    if (end !== -1) {
      const fmText = text.slice(4, end);
      const body = text.slice(end + 5);
      const fm = {};
      for (const line of fmText.split("\n")) {
        const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (m) {
          let v = m[2];
          if (v === "true") v = true;
          else if (v === "false") v = false;
          else if (typeof v === "string" && /^-?\d+$/.test(v)) v = Number(v);
          else if (typeof v === "string") v = v.replace(/^['"]|['"]$/g, "");
          fm[m[1]] = v;
        }
      }
      return { frontmatter: fm, body };
    }
  }
  return { frontmatter: {}, body: text };
}
function sections(body) {
  const out = {};
  for (const m of body.matchAll(MARKER_RE)) out[m[1]] = (m[2] ?? "").trim();
  return out;
}
function sectionIsEmpty(content) {
  return !content || content.trim() === "" || content.trim() === "_Not yet developed._";
}
function parseCanonicalVerses(body) {
  const out = [];
  for (const line of body.split("\n")) {
    const m = /^\*\*(\d{1,3})\*\*\s+([\s\S]*?)\s+\^([a-z0-9]+-\d+-\d+)\s*$/.exec(line);
    if (m) out.push({ verse: Number(m[1]), text: m[2], verseId: m[3] });
  }
  return out;
}
function extractWikilinks(text) {
  const out = [];
  for (const m of text.matchAll(/\[\[([^\[\]|#]+)(#[^\[\]|]*)?(?:\|[^\[\]]*)?\]\]/g)) {
    out.push({ target: m[1].trim(), anchor: (m[2] ?? "").trim() });
  }
  return out;
}
function trimContext(items, depth) {
  const budget = DEPTH_BUDGET[depth];
  const sorted = [...items].sort((a, b) => a.priority - b.priority);
  const out = [];
  let used = 0;
  for (const it of sorted) {
    if (out.length > 0 && used + it.text.length > budget * 1.15) continue;
    out.push(it);
    used += it.text.length;
  }
  return out;
}
var MARKER_RE, DEPTH_BUDGET;
var init_markdown = __esm({
  "../../packages/core-sdk/src/markdown.ts"() {
    "use strict";
    MARKER_RE = /<!-- SG:BEGIN ([a-z0-9_-]+) -->\n?([\s\S]*?)\n?<!-- SG:END \1 -->/g;
    DEPTH_BUDGET = {
      focused: 12e3,
      balanced: 32e3,
      deep: 9e4
    };
  }
});

// ../../packages/core-sdk/src/ai/openrouter.ts
function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeVerifier() {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return b64url(bytes);
}
async function challengeS256(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return b64url(new Uint8Array(digest));
}
function authUrl(callbackUrl, challenge) {
  const cb = encodeURIComponent(callbackUrl);
  return `${OPENROUTER_BASE}/auth?callback_url=${cb}&code_challenge=${challenge}&code_challenge_method=S256`;
}
async function exchangeCode(code, verifier) {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/auth/keys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, code_verifier: verifier, code_challenge_method: "S256" })
  });
  if (!res.ok) throw new Error(`OpenRouter key exchange failed (${res.status})`);
  const data = await res.json();
  if (!data.key) throw new Error("OpenRouter returned no key");
  return data.key;
}
async function listModels() {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/models`, {
    headers: { accept: "application/json" }
  });
  if (!res.ok) throw new Error(`model list failed (${res.status})`);
  const data = await res.json();
  return data.data.map((m) => ({
    id: m.id,
    name: m.name ?? m.id,
    context_length: m.context_length ?? 8192,
    promptPrice: Number(m.pricing?.prompt ?? 0) * 1e6,
    completionPrice: Number(m.pricing?.completion ?? 0) * 1e6
  }));
}
async function keyStatus(apiKey) {
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/auth/key`, {
    headers: { authorization: `Bearer ${apiKey}` }
  });
  if (!res.ok) throw new Error(`key status failed (${res.status})`);
  const data = await res.json();
  return { usageUsd: data.data?.usage ?? 0, limitUsd: data.data?.limit ?? null };
}
async function chat(apiKey, model, messages, opts = {}) {
  const stream = !!opts.onDelta;
  const res = await fetch(`${OPENROUTER_BASE}/api/v1/chat/completions`, {
    method: "POST",
    signal: opts.signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://scripturegraph.local",
      "X-Title": "Scripture Graph"
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
      max_tokens: opts.maxTokens,
      usage: { include: true }
    })
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  let text = "";
  let usage = { prompt_tokens: 0, completion_tokens: 0, costUsd: 0 };
  if (stream && res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const j = JSON.parse(payload);
          const delta = j.choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            opts.onDelta(delta);
          }
          if (j.usage) {
            usage = {
              prompt_tokens: j.usage.prompt_tokens ?? 0,
              completion_tokens: j.usage.completion_tokens ?? 0,
              costUsd: j.usage.cost ?? 0
            };
          }
        } catch {
        }
      }
    }
  } else {
    const j = await res.json();
    text = j.choices?.[0]?.message?.content ?? "";
    usage = {
      prompt_tokens: j.usage?.prompt_tokens ?? 0,
      completion_tokens: j.usage?.completion_tokens ?? 0,
      costUsd: j.usage?.cost ?? 0
    };
  }
  return { text, usage };
}
var OPENROUTER_BASE;
var init_openrouter = __esm({
  "../../packages/core-sdk/src/ai/openrouter.ts"() {
    "use strict";
    OPENROUTER_BASE = "https://openrouter.ai";
  }
});

// ../../packages/core-sdk/src/ai/models.ts
function pickModel(registry, task, prefs) {
  const ids = new Set(registry.map((m) => m.id));
  const byId = new Map(registry.map((m) => [m.id, m]));
  if (prefs.tier === "specific" && prefs.specificModel && ids.has(prefs.specificModel)) {
    return { modelId: prefs.specificModel, reason: "user-selected model" };
  }
  let tier = prefs.tier;
  if (tier === "auto") {
    tier = prefs.routing?.[task] ?? DEFAULT_ROUTING[task];
  }
  if (tier === "cheapest") {
    const paid = registry.filter((m) => m.promptPrice + m.completionPrice > 0 && m.context_length >= 16e3).sort((a, b) => a.promptPrice + a.completionPrice - (b.promptPrice + b.completionPrice));
    if (paid[0]) return { modelId: paid[0].id, reason: "cheapest capable model" };
    tier = "fast";
  }
  const candidates = TIER_CANDIDATES[tier === "auto" || tier === "specific" ? "fast" : tier];
  for (const c of candidates) {
    if (ids.has(c)) return { modelId: c, reason: `${tier} tier` };
  }
  const fallback = registry.filter((m) => m.context_length >= 32e3).sort((a, b) => a.promptPrice + a.completionPrice - (b.promptPrice + b.completionPrice));
  const mid = fallback[Math.floor(fallback.length / 3)] ?? fallback[0];
  if (mid) return { modelId: mid.id, reason: "registry fallback" };
  throw new Error("no models available from provider");
}
var DEFAULT_ROUTING, TIER_CANDIDATES;
var init_models = __esm({
  "../../packages/core-sdk/src/ai/models.ts"() {
    "use strict";
    DEFAULT_ROUTING = {
      define: "fast",
      verse: "fast",
      chapter: "fast",
      connections: "fast",
      history: "deep",
      language: "deep",
      evidence: "deep",
      challenge: "deep",
      brainstorm: "fast",
      compare: "fast",
      vault: "deep",
      lesson: "best",
      talk: "best"
    };
    TIER_CANDIDATES = {
      fast: [
        "anthropic/claude-haiku-4.5",
        "openai/gpt-5-mini",
        "google/gemini-2.5-flash",
        "openai/gpt-4.1-mini",
        "anthropic/claude-3.5-haiku"
      ],
      deep: [
        "anthropic/claude-sonnet-5",
        "openai/gpt-5",
        "google/gemini-2.5-pro",
        "anthropic/claude-sonnet-4.5",
        "openai/o4-mini"
      ],
      best: [
        "anthropic/claude-opus-5",
        "openai/gpt-5.2",
        "anthropic/claude-sonnet-5",
        "openai/gpt-5",
        "google/gemini-2.5-pro"
      ]
    };
  }
});

// ../../packages/core-sdk/src/ai/budget.ts
function monthKey(d = /* @__PURE__ */ new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
var KEY, Budget;
var init_budget = __esm({
  "../../packages/core-sdk/src/ai/budget.ts"() {
    "use strict";
    KEY = "ai_budget";
    Budget = class {
      constructor(store) {
        this.store = store;
      }
      async state() {
        const s = await this.store.get(KEY);
        const mk = monthKey();
        if (!s || s.monthKey !== mk) {
          const fresh = { monthKey: mk, spentUsd: 0, capUsd: s?.capUsd ?? 10, requests: 0 };
          await this.store.put(KEY, fresh);
          return fresh;
        }
        return s;
      }
      async setCap(capUsd) {
        const s = await this.state();
        await this.store.put(KEY, { ...s, capUsd: Math.max(0, capUsd) });
      }
      async addUsage(costUsd) {
        const s = await this.state();
        const next = { ...s, spentUsd: s.spentUsd + Math.max(0, costUsd), requests: s.requests + 1 };
        await this.store.put(KEY, next);
        return next;
      }
      /** true when a NEW request may start (§30: cap stops initiation). */
      async mayStart() {
        const s = await this.state();
        return { ok: s.capUsd <= 0 || s.spentUsd < s.capUsd, s };
      }
    };
  }
});

// ../../packages/core-sdk/src/index.ts
var init_src = __esm({
  "../../packages/core-sdk/src/index.ts"() {
    "use strict";
    init_schemas();
    init_anchors();
    init_localstore();
    init_api();
    init_syncengine();
    init_markdown();
    init_openrouter();
    init_models();
    init_budget();
  }
});

// src/study/themeLibrary.ts
function themeSpec(name, custom2 = [], colorHex = {}) {
  const hit = BY_NAME.get(name.toLowerCase());
  if (hit) return hit;
  const user = custom2.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (user) {
    const hex = colorHex[user.color] ?? user.color ?? "#e8c547";
    return { name: user.name, emoji: "\u{1F3F7}\uFE0F", c1: hex, c2: hex };
  }
  return { name, emoji: "\u{1F3F7}\uFE0F", c1: "#8d99ae", c2: "#8d99ae" };
}
function hexToRgba(hex, alpha) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(141,153,174,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${alpha})`;
}
function themeWash(spec, layerAlpha) {
  return `linear-gradient(120deg, ${hexToRgba(spec.c1, layerAlpha)}, ${hexToRgba(spec.c2, layerAlpha * 0.75)})`;
}
function themeRibbons(specs) {
  return specs.map((s, i) => `inset ${(i + 1) * 4}px 0 0 ${s.c1}`).join(", ");
}
var THEME_LIBRARY, BY_NAME;
var init_themeLibrary = __esm({
  "src/study/themeLibrary.ts"() {
    "use strict";
    THEME_LIBRARY = [
      { name: "Jesus Christ", emoji: "\u271D\uFE0F", c1: "#e8c547", c2: "#f5ead1" },
      { name: "Faith", emoji: "\u{1F331}", c1: "#4cc38a", c2: "#a8e6c1" },
      { name: "Hope", emoji: "\u{1F305}", c1: "#ff9f45", c2: "#ffd166" },
      { name: "Charity", emoji: "\u2764\uFE0F", c1: "#f76bb0", c2: "#ff9aa2" },
      { name: "Forgiveness", emoji: "\u{1F54A}\uFE0F", c1: "#52a9ff", c2: "#a5d8ff" },
      { name: "Repentance", emoji: "\u{1F504}", c1: "#ffb347", c2: "#f76bb0" },
      { name: "Sin", emoji: "\u26A0\uFE0F", c1: "#d64550", c2: "#8b2635" },
      { name: "Awe", emoji: "\u{1F30C}", c1: "#6c5ce7", c2: "#a29bfe" },
      { name: "Remember", emoji: "\u{1F397}\uFE0F", c1: "#e8c547", c2: "#d4a017" },
      { name: "Interesting", emoji: "\u{1F4A1}", c1: "#22d3ee", c2: "#a3e635" },
      { name: "Covenant", emoji: "\u{1F91D}", c1: "#3b6fd6", c2: "#e8c547" },
      { name: "Prayer", emoji: "\u{1F64F}", c1: "#b197fc", c2: "#74c0fc" },
      { name: "Promise", emoji: "\u{1F308}", c1: "#63e6be", c2: "#ffd43b" },
      { name: "Prophecy", emoji: "\u{1F52E}", c1: "#9775fa", c2: "#4c3fb5" },
      { name: "Commandment", emoji: "\u{1F4DC}", c1: "#8d99ae", c2: "#5c677d" },
      { name: "Comfort", emoji: "\u{1F56F}\uFE0F", c1: "#ffb997", c2: "#ffe0c2" },
      { name: "Joy", emoji: "\u{1F60A}", c1: "#ffd43b", c2: "#ff9f45" },
      { name: "Wisdom", emoji: "\u{1F989}", c1: "#20b2aa", c2: "#5f7a8a" },
      { name: "Family", emoji: "\u{1F3E1}", c1: "#ff9aa2", c2: "#ffdac1" },
      { name: "Service", emoji: "\u{1FAF1}", c1: "#38d9a9", c2: "#4dabf7" },
      { name: "Warning", emoji: "\u{1F6A8}", c1: "#ff6b6b", c2: "#ffa94d" },
      { name: "Question", emoji: "\u2753", c1: "#adb5bd", c2: "#74c0fc" }
    ];
    BY_NAME = new Map(THEME_LIBRARY.map((t) => [t.name.toLowerCase(), t]));
  }
});

// src/social/annotations.ts
function decorateVerse(s, svc, p, verseId, mine, social) {
  p.querySelectorAll(".sgh, .sg-badge, .sgh-note-icon, .sg-theme-badges").forEach((el) => {
    if (el.classList.contains("sgh")) {
      const parent = el.parentNode;
      while (el.firstChild) parent?.insertBefore(el.firstChild, el);
    }
    el.remove();
  });
  if (p.hasAttribute("data-sg-themed")) {
    p.removeAttribute("data-sg-themed");
    p.removeClass("sg-themed");
    p.style.backgroundImage = "";
    p.style.boxShadow = "";
    p.style.paddingLeft = "";
  }
  mine = mine.filter((a) => !a.deleted_at);
  social = social.filter((a) => !a.deleted_at);
  const all = [
    ...s.device.showScopes.mine ? mine : [],
    ...social
  ].filter((a) => a.annotation_type === "highlight");
  const themed = all.filter((a) => a.theme && !a.selected_text);
  const visible = all.filter((a) => !(a.theme && !a.selected_text));
  for (const h of visible) applyMark(p, h);
  if (themed.length) {
    const names = [];
    for (const t of themed) {
      if (t.theme && !names.some((n) => n.toLowerCase() === t.theme.toLowerCase())) {
        names.push(t.theme);
      }
    }
    const specs = names.map((n) => themeSpec(n, s.settings.themes ?? [], COLOR_HEX));
    p.setAttribute("data-sg-themed", "1");
    p.addClass("sg-themed");
    const alpha = Math.max(0.06, 0.16 / specs.length);
    p.style.backgroundImage = specs.map((sp) => themeWash(sp, alpha)).join(", ");
    p.style.boxShadow = themeRibbons(specs);
    p.style.paddingLeft = `${8 + specs.length * 4}px`;
    const badges = p.createSpan({ cls: "sg-theme-badges" });
    for (const sp of specs) {
      const chip = badges.createSpan({ cls: "sg-theme-badge", text: sp.emoji });
      chip.setAttribute("aria-label", sp.name);
      chip.style.borderBottom = `2px solid ${sp.c1}`;
      chip.onclick = (e) => {
        e.stopPropagation();
        new NotesPopover(s, svc, verseId).open();
      };
    }
  }
  const openPopover = () => new NotesPopover(s, svc, verseId).open();
  if (s.device.showScopes.mine) {
    const kinds = [
      ["note", "\u{1F4DD}"],
      ["study-marker", "\u{1F0CF}"],
      ["bookmark", "\u{1F516}"]
    ];
    for (const [kind, glyph] of kinds) {
      if (mine.some((a) => a.annotation_type === kind)) {
        const icon = p.createSpan({ cls: "sgh-note-icon", text: glyph });
        icon.setAttribute("aria-label", "View your marks on this verse");
        icon.onclick = openPopover;
      }
    }
  }
  const others = social.filter((a) => a.annotation_type !== "bookmark");
  if (others.length) {
    const names = new Set(others.map((a) => a.author_name ?? "someone"));
    const badge = p.createSpan({
      cls: "sg-badge",
      text: ` \u{1F465} ${names.size}`,
      attr: { "aria-label": `${names.size} shared this \u2014 tap to view` }
    });
    badge.onclick = openPopover;
  }
}
function styleMark(mark, h) {
  const color = h.color ?? "yellow";
  const hex = COLOR_HEX[color] ?? "#f5d90a";
  const bg = MARK_BG[color] ?? MARK_BG["yellow"];
  mark.style.color = "inherit";
  mark.style.background = "transparent";
  switch (h.style ?? "highlight") {
    case "underline":
      mark.style.borderBottom = `2px solid ${hex}`;
      break;
    case "bold":
      mark.style.fontWeight = "700";
      mark.style.borderBottom = `2px solid ${hex}`;
      break;
    case "italic":
      mark.style.fontStyle = "italic";
      mark.style.borderBottom = `2px dotted ${hex}`;
      break;
    default:
      mark.style.backgroundColor = bg;
  }
  if (h.theme) mark.setAttribute("aria-label", `Theme: ${h.theme}`);
}
function applyMark(p, h) {
  const cls = `sgh sgh-${h.color ?? "yellow"}`;
  if (!h.selected_text) {
    const strong = p.querySelector("strong");
    let node = strong ? strong.nextSibling : p.firstChild;
    const mark = document.createElement("mark");
    mark.className = cls;
    styleMark(mark, h);
    const moving = [];
    while (node) {
      const el = node;
      if (!(el.classList?.contains("sgh-note-icon") || el.classList?.contains("sg-badge"))) {
        moving.push(node);
      }
      node = node.nextSibling;
    }
    if (!moving.length) return;
    p.insertBefore(mark, moving[0]);
    moving.forEach((m) => mark.appendChild(m));
    return;
  }
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let t;
  while (t = walker.nextNode()) {
    const idx = t.nodeValue?.indexOf(h.selected_text) ?? -1;
    if (idx === -1) continue;
    const range = document.createRange();
    range.setStart(t, idx);
    range.setEnd(t, idx + h.selected_text.length);
    const mark = document.createElement("mark");
    mark.className = cls;
    styleMark(mark, h);
    try {
      range.surroundContents(mark);
    } catch {
    }
    return;
  }
}
var import_obsidian2, COLORS, COLOR_HEX, MARK_BG, NoteModal, AnnotationService, NotesPopover;
var init_annotations = __esm({
  "src/social/annotations.ts"() {
    "use strict";
    import_obsidian2 = require("obsidian");
    init_src();
    init_themeLibrary();
    COLORS = ["yellow", "green", "blue", "pink", "orange"];
    COLOR_HEX = {
      yellow: "#f5d90a",
      green: "#4cc38a",
      blue: "#52a9ff",
      pink: "#f76bb0",
      orange: "#ff9f45"
    };
    MARK_BG = {
      yellow: "rgba(245,217,10,0.40)",
      green: "rgba(76,195,138,0.35)",
      blue: "rgba(82,169,255,0.35)",
      pink: "rgba(247,107,176,0.35)",
      orange: "rgba(255,159,69,0.40)"
    };
    NoteModal = class extends import_obsidian2.Modal {
      constructor(state, refLabel, onSubmit) {
        super(state.app);
        this.refLabel = refLabel;
        this.onSubmit = onSubmit;
      }
      onOpen() {
        this.contentEl.addClass("sg-note-modal");
        this.contentEl.createEl("h3", { text: `Note on ${this.refLabel}` });
        const ta = this.contentEl.createEl("textarea", {
          attr: { placeholder: "Your thought\u2026" }
        });
        const btn = this.contentEl.createEl("button", { text: "Save" });
        btn.addEventListener("click", () => {
          const v = ta.value.trim();
          this.close();
          if (v) this.onSubmit(v);
        });
        setTimeout(() => ta.focus(), 30);
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    AnnotationService = class {
      constructor(s) {
        this.s = s;
        s.redecorate = () => this.redecorateOpen();
      }
      syncTimer = null;
      /** Refresh decorations on every verse currently rendered, without
       * re-rendering the page (which would scroll the user to the top). */
      async redecorateOpen() {
        const seen = /* @__PURE__ */ new Set();
        const paras = document.querySelectorAll(
          ".markdown-preview-view [data-verse-id], .sg-reader [data-verse-id]"
        );
        for (const p of Array.from(paras)) {
          if (seen.has(p)) continue;
          seen.add(p);
          const vid = p.getAttribute("data-verse-id");
          if (!vid) continue;
          const mine = await this.mine(vid);
          decorateVerse(this.s, this, p, vid, mine, this.social(vid));
        }
      }
      start() {
        this.scheduleSync(5e3);
        this.syncTimer = window.setInterval(() => void this.syncNow(), 6e4);
      }
      stop() {
        if (this.syncTimer) window.clearInterval(this.syncTimer);
      }
      scheduleSync(delayMs = 3e3) {
        window.setTimeout(() => void this.syncNow(), delayMs);
      }
      async syncNow() {
        if (!this.s.signedIn) return;
        try {
          await this.s.sync.flush(this.s.api);
          await this.s.sync.pull(this.s.api);
          this.s.notify();
        } catch {
        }
      }
      // -------------------------------------------------------------- writes
      base(anchorId, type) {
        const vis = this.s.settings.defaultVisibility === "local" ? "local" : "private";
        return {
          annotation_id: uuid(),
          author_user_id: this.s.device.userId,
          anchor_type: parseVerseId(anchorId) ? "verse" : anchorId.includes(":") ? "node" : "chapter",
          anchor_id: anchorId,
          annotation_type: type,
          selected_text: null,
          start_offset: null,
          end_offset: null,
          text_hash: null,
          content: "",
          color: null,
          style: null,
          theme: null,
          visibility: vis,
          group_id: null,
          created_at: nowIso(),
          updated_at: nowIso(),
          deleted_at: null,
          version: 1
        };
      }
      async addHighlight(anchorId, color, verseText, selected, visibility, groupId, style = null, theme = null) {
        const a = this.base(anchorId, "highlight");
        a.color = color;
        a.style = style;
        a.theme = theme;
        a.visibility = visibility;
        a.group_id = groupId;
        if (selected && verseText) {
          const p = makePartialAnchor(verseText, selected);
          if (p) Object.assign(a, p);
        }
        await this.s.sync.save(a);
        this.scheduleSync();
        this.s.rerenderReading();
      }
      async addNote(anchorId, text, quoted, visibility, groupId) {
        const a = this.base(anchorId, "note");
        a.content = quoted ? `> "${quoted}"

${text}` : text;
        a.visibility = visibility;
        a.group_id = groupId;
        await this.s.sync.save(a);
        this.scheduleSync();
        this.s.rerenderReading();
      }
      /** Whole-verse theme tag: tap once to add, tap again to remove (§themes).
       * Returns true when the theme was ADDED. */
      async toggleTheme(anchorId, themeName, primaryHex, visibility, groupId) {
        const mine = await this.mine(anchorId);
        const existing = mine.find((a) => a.annotation_type === "highlight" && !a.selected_text && a.theme?.toLowerCase() === themeName.toLowerCase());
        if (existing) {
          await this.remove(existing.annotation_id);
          return false;
        }
        await this.addHighlight(
          anchorId,
          primaryHex,
          null,
          null,
          visibility,
          groupId,
          "theme",
          themeName
        );
        return true;
      }
      async setVisibility(id, visibility, groupId) {
        const a = await this.s.sync.getAnnotation(id);
        if (!a || a.author_user_id !== this.s.device.userId && a.author_user_id !== null) return;
        const next = { ...a, visibility, group_id: groupId, updated_at: nowIso() };
        await this.s.sync.save(next);
        this.scheduleSync();
        this.s.rerenderReading();
      }
      async remove(id) {
        await this.s.sync.softDelete(id);
        this.scheduleSync();
        this.s.rerenderReading();
      }
      // --------------------------------------------------------------- reads
      /** my annotations (any scope) for an anchor */
      async mine(anchorId) {
        const all = await this.s.sync.annotationsForAnchor(anchorId);
        return all.filter((a) => a.author_user_id === this.s.device.userId || a.author_user_id === null);
      }
      /** others' shared annotations from the social cache (filtered by scopes) */
      social(anchorId) {
        const rows = this.s.socialCache.get(anchorId) ?? [];
        const f = this.s.device.showScopes;
        return rows.filter((a) => {
          if (a.author_user_id === this.s.device.userId) return false;
          if (a.visibility === "public") return f.public;
          if (a.visibility === "group" && a.group_id) return f.groups[a.group_id] !== false;
          return false;
        });
      }
      /** refresh the social cache for a chapter's verse anchors */
      async refreshSocial(anchorIds) {
        if (!this.s.signedIn || anchorIds.length === 0) return;
        try {
          const res = await this.s.api.annotationsFor(anchorIds);
          for (const id of anchorIds) this.s.socialCache.set(id, []);
          for (const a of res.annotations) {
            const arr = this.s.socialCache.get(a.anchor_id) ?? [];
            arr.push(a);
            this.s.socialCache.set(a.anchor_id, arr);
          }
          this.s.notify();
        } catch {
        }
      }
      // ------------------------------------------------------------ share menu
      visibilityMenu(onPick) {
        const menu = new import_obsidian2.Menu();
        menu.addItem((i) => i.setTitle("\u{1F512} Only me (this device)").onClick(() => onPick("local", null, "Only me \u2014 this device")));
        menu.addItem((i) => i.setTitle("\u{1F510} Only me (synced)").onClick(() => onPick("private", null, "Only me")));
        for (const g of this.s.groups) {
          menu.addItem((i) => i.setTitle(`\u{1F465} ${g.name}`).onClick(() => onPick("group", g.group_id, g.name)));
        }
        menu.addItem((i) => i.setTitle("\u{1F30E} Public (everyone in Scripture Graph)").onClick(() => onPick("public", null, "Public")));
        return menu;
      }
    };
    NotesPopover = class extends import_obsidian2.Modal {
      constructor(s, svc, verseId) {
        super(s.app);
        this.s = s;
        this.svc = svc;
        this.verseId = verseId;
      }
      async onOpen() {
        const { contentEl } = this;
        contentEl.addClass("sg-popover");
        contentEl.createEl("h3", { text: verseDisplay(this.verseId) ?? this.verseId });
        const mine = await this.svc.mine(this.verseId);
        const social = this.svc.social(this.verseId);
        if (mine.length) {
          contentEl.createEl("h4", { text: "Mine" });
          for (const a of mine) this.row(contentEl, a, true);
        }
        if (social.length) {
          contentEl.createEl("h4", { text: "Shared" });
          for (const a of social) this.row(contentEl, a, false);
        }
        if (!mine.length && !social.length) {
          contentEl.createEl("p", {
            text: "No marks on this verse yet \u2014 tap the verse and pick a color to highlight it."
          });
        }
      }
      row(root, a, isMine) {
        const div = root.createDiv({ cls: "sg-ann-row" });
        const visLabel = a.visibility === "local" ? "\u{1F512} device" : a.visibility === "private" ? "\u{1F510} me" : a.visibility === "group" ? `\u{1F465} ${this.s.groups.find((g) => g.group_id === a.group_id)?.name ?? "group"}` : "\u{1F30E} public";
        const kindLabel = a.annotation_type === "study-marker" ? "flashcard" : a.annotation_type;
        const themeLabel = a.theme ? ` \xB7 \u{1F3F7} ${a.theme}` : "";
        div.createEl("div", {
          cls: "sg-ann-meta",
          text: `${isMine ? "You" : a.author_name ?? "someone"} \xB7 ${kindLabel}${a.color ? ` (${a.color}${a.style && a.style !== "highlight" ? ` ${a.style}` : ""})` : ""}${themeLabel} \xB7 ${visLabel}`
        });
        if (a.selected_text) div.createEl("blockquote", { text: a.selected_text });
        if (a.annotation_type === "study-marker") {
          try {
            const d = JSON.parse(a.content);
            div.createEl("p", { text: `\u{1F0CF} ${d.front ?? "Card"}` });
            if (d.back) div.createEl("p", { cls: "sg-card-back", text: `\u2192 ${d.back}` });
          } catch {
            div.createEl("p", { text: "\u{1F0CF} Flashcard" });
          }
        } else if (a.annotation_type === "bookmark") {
          div.createEl("p", { text: `\u{1F516} ${a.content || "Bookmark"}` });
        } else if (a.content) {
          div.createEl("p", { text: a.content });
        }
        if (isMine) {
          const actions = div.createDiv({ cls: "sg-ann-actions" });
          const share = actions.createEl("button", { text: "Change sharing" });
          share.onclick = (e) => {
            this.svc.visibilityMenu((vis, gid, label) => {
              void this.svc.setVisibility(a.annotation_id, vis, gid);
              new import_obsidian2.Notice(`Now visible to: ${label}`);
              this.close();
            }).showAtMouseEvent(e);
          };
          const del = actions.createEl("button", { text: "Delete" });
          del.onclick = async () => {
            del.setAttribute("disabled", "true");
            del.setText("Deleting\u2026");
            try {
              await this.svc.remove(a.annotation_id);
              new import_obsidian2.Notice("Deleted");
            } catch (e) {
              new import_obsidian2.Notice(`Delete failed: ${e.message}`);
            }
            this.close();
          };
        }
      }
      onClose() {
        this.contentEl.empty();
      }
    };
  }
});

// src/study/trace.ts
var trace_exports = {};
__export(trace_exports, {
  setOverlay: () => setOverlay,
  trace: () => trace,
  traceDump: () => traceDump
});
function trace(kind, data = {}) {
  const entry = {
    t: Date.now() - START,
    kind,
    data: Object.entries(data).map(([k, v]) => `${k}=${String(v)}`).join(" ")
  };
  BUF.push(entry);
  if (BUF.length > MAX) BUF.shift();
  if (overlayEl) {
    const last = BUF.slice(-4).map((e) => `${(e.t / 1e3).toFixed(1)}s ${e.kind} ${e.data}`);
    overlayEl.setText(last.join("\n"));
  }
}
function traceDump() {
  return BUF.map((e) => `${(e.t / 1e3).toFixed(2)}s ${e.kind} ${e.data}`).join("\n");
}
function setOverlay(on) {
  if (on && !overlayEl) {
    overlayEl = document.body.createDiv({ cls: "sg-trace-overlay" });
  } else if (!on && overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
}
var BUF, MAX, START, overlayEl;
var init_trace = __esm({
  "src/study/trace.ts"() {
    "use strict";
    BUF = [];
    MAX = 300;
    START = Date.now();
    overlayEl = null;
  }
});

// src/study/studyBar.ts
var studyBar_exports = {};
__export(studyBar_exports, {
  StudyBar: () => StudyBar,
  openLocalGraphFor: () => openLocalGraphFor
});
async function openLocalGraphFor(s, linkText) {
  if (!linkText) return void new import_obsidian7.Notice("Nothing to graph here yet");
  const f = s.app.metadataCache.getFirstLinkpathDest(linkText, "");
  if (!f) return void new import_obsidian7.Notice(`Can't find \u201C${linkText}\u201D`);
  const leaf = s.app.workspace.getLeaf("tab");
  await leaf.setViewState({ type: "localgraph", active: true, state: { file: f.path } });
  await s.app.workspace.revealLeaf(leaf);
  trace("graph.open", { file: f.path });
}
var import_obsidian7, SCOPE_LABEL, StudyBar, ThemeNameModal;
var init_studyBar = __esm({
  "src/study/studyBar.ts"() {
    "use strict";
    import_obsidian7 = require("obsidian");
    init_src();
    init_annotations();
    init_themeLibrary();
    init_trace();
    SCOPE_LABEL = {
      local: "\u{1F512} This device",
      private: "\u{1F510} Only me",
      group: "\u{1F465}",
      public: "\u{1F30E} Public"
    };
    StudyBar = class {
      constructor(s, ann, study, openAsk, saveSettings = async () => {
      }) {
        this.s = s;
        this.ann = ann;
        this.study = study;
        this.openAsk = openAsk;
        this.saveSettings = saveSettings;
      }
      sel = { verses: [], partial: null };
      barEl = null;
      selTimer = null;
      lastSig = "";
      // touch-tap discrimination state (mobile)
      downX = 0;
      downY = 0;
      downT = 0;
      downHadSelection = false;
      lastScrollT = 0;
      lastSelText = "";
      // ------------------------------------------------------------ tap wiring
      /** Input wiring, modeled on Hypothesis's battle-tested selection observer:
       *  - the selection is captured shortly AFTER pointer-up (it isn't final at
       *    the event itself on iOS), and settles via a short debounce while
       *    handles are dragged — and it is NEVER cleared by us: the captured
       *    phrase lives in bar state, so actions work even after iOS collapses
       *    the native selection (e.g. when tapping a bar button).
       *  - a tap is only a tap when the finger didn't move, didn't linger,
       *    didn't land mid-scroll, and wasn't dismissing a selection. */
      isPointerDown = false;
      attach(plugin) {
        plugin.registerDomEvent(document, "pointerdown", (evt) => {
          this.isPointerDown = true;
          this.downX = evt.clientX;
          this.downY = evt.clientY;
          this.downT = Date.now();
          const native = window.getSelection();
          this.downHadSelection = !!native && !native.isCollapsed;
        }, { capture: true, passive: true });
        plugin.registerDomEvent(document, "pointercancel", () => {
          this.isPointerDown = false;
        }, { capture: true, passive: true });
        plugin.registerDomEvent(document, "pointerup", (evt) => {
          this.isPointerDown = false;
          const dx = Math.abs(evt.clientX - this.downX);
          const dy = Math.abs(evt.clientY - this.downY);
          const dt = Date.now() - this.downT;
          const target = evt.target instanceof Element ? evt.target : null;
          window.setTimeout(() => {
            const native = window.getSelection();
            const hasSel = !!native && !native.isCollapsed;
            if (hasSel) {
              trace("up.capture", { dt, len: native.toString().length });
              this.capturePartial(native);
              return;
            }
            if (this.downHadSelection) {
              trace("up.dismissedSelection", { dt });
              if (this.sel.partial) this.clear();
              return;
            }
            if (!import_obsidian7.Platform.isMobile) return;
            if (dx > 10 || dy > 10) return trace("up.moved", { dx, dy });
            if (dt > 500) return trace("up.longpress", { dt });
            if (Date.now() - this.lastScrollT < 250) return trace("up.midscroll", {});
            trace("up.tap", { dt });
            this.handleTap({ target });
          }, 30);
        });
        plugin.registerDomEvent(document, "scroll", () => {
          this.lastScrollT = Date.now();
        }, { capture: true, passive: true });
        if (!import_obsidian7.Platform.isMobile) {
          plugin.registerDomEvent(document, "click", (evt) => this.handleTap(evt));
        }
        plugin.registerDomEvent(document, "selectionchange", () => this.handleSelectionChange());
      }
      /** Delegated tap handling for any container that renders verses. */
      handleTap(evt) {
        const target = evt.target instanceof Element ? evt.target : null;
        if (!target) return;
        if (target.closest(".sg-studybar, .modal, .menu, .prompt")) return;
        if (target.closest("a, button, input, textarea, select")) return;
        if (target.closest(".cm-editor")) return;
        const mark = target.closest("mark.sgh, .sgh-note-icon, .sg-badge");
        if (mark) {
          const p2 = mark.closest("[data-verse-id], p");
          const vid2 = this.verseIdOf(p2);
          if (vid2) {
            new NotesPopover(this.s, this.ann, vid2).open();
            return;
          }
        }
        const native = window.getSelection();
        if (native && !native.isCollapsed) return;
        const p = target.closest("[data-verse-id], p");
        const vid = this.verseIdOf(p);
        if (!vid || !(p instanceof HTMLElement)) {
          if (this.sel.verses.length || this.sel.partial) this.clear();
          return;
        }
        const onNumber = !!target.closest("strong");
        if (!onNumber) {
          trace("tap.verseText", { vid });
          if (this.sel.verses.length || this.sel.partial) this.clear();
          return;
        }
        this.toggleVerse(vid, p);
      }
      /** selectionchange path (Hypothesis timing): ignored while the pointer is
       * down (pointer-up captures those); otherwise a 100ms settle captures
       * keyboard/handle-adjusted selections. A COLLAPSED selection never clears
       * the bar — the captured phrase is our state, and iOS collapses the native
       * selection for all sorts of reasons (including tapping our own buttons). */
      handleSelectionChange() {
        if (this.selTimer) window.clearTimeout(this.selTimer);
        this.selTimer = window.setTimeout(() => {
          if (this.isPointerDown) return;
          const native = window.getSelection();
          const text = native && !native.isCollapsed ? native.toString().trim() : "";
          if (!text) return;
          if (this.sel.partial?.selected === text) return;
          trace("selchange.capture", { len: text.length });
          this.capturePartial(native);
        }, 100);
      }
      /** Native selection → partial-phrase state (selection left untouched). */
      capturePartial(native) {
        const text = native.toString().trim();
        if (text.length < 3 || text.length > 600) return;
        const anchor = native.anchorNode instanceof Element ? native.anchorNode : native.anchorNode?.parentElement;
        if (!anchor || anchor.closest(".cm-editor")) return;
        const p = anchor.closest("[data-verse-id], p");
        const vid = this.verseIdOf(p);
        if (!vid) {
          trace("capture.noVerse", {});
          return;
        }
        if (this.sel.partial?.selected === text && this.sel.partial.verseId === vid) return;
        trace("capture.partial", { vid, len: text.length });
        this.setPartial(vid, this.verseTextOf(p), text);
      }
      verseIdOf(el) {
        if (!el) return null;
        const direct = el.getAttribute?.("data-verse-id") ?? el.closest("[data-verse-id]")?.getAttribute("data-verse-id");
        if (direct && parseVerseId(direct)) return direct;
        if (!(el instanceof HTMLElement) || el.tagName !== "P") return null;
        const strong = el.querySelector("strong");
        const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
        if (!Number.isFinite(n)) return null;
        const slug = this.slugForContainer(el);
        return slug && parseVerseId(`${slug}-${n}`) ? `${slug}-${n}` : null;
      }
      slugForContainer(el) {
        const embed = el.closest(".internal-embed[src]");
        const src = embed?.getAttribute("src") ?? null;
        if (src?.includes("#^")) return null;
        const app = this.s.app;
        if (src) {
          const dest = app.metadataCache.getFirstLinkpathDest(src.split("#")[0], "");
          if (!dest) return null;
          return app.metadataCache.getFileCache(dest)?.frontmatter?.slug ?? null;
        }
        const f = app.workspace.getActiveFile();
        if (!f) return null;
        return app.metadataCache.getFileCache(f)?.frontmatter?.slug ?? null;
      }
      /** Verse text WITHOUT our decoration glyphs (📝/🃏/👥 icons would otherwise
       * leak into copies, note quotes, and card-dedup comparisons). */
      verseTextOf(p) {
        const clone = p.cloneNode(true);
        clone.querySelectorAll(".sgh-note-icon, .sg-badge").forEach((e) => e.remove());
        return (clone.textContent ?? "").replace(/^\s*\d+\s*/, "").trim();
      }
      // ------------------------------------------------------- selection state
      toggleVerse(verseId, el) {
        trace("verse.toggle", { verseId });
        this.sel.partial = null;
        const i = this.sel.verses.findIndex((v) => v.verseId === verseId);
        if (i >= 0) {
          this.sel.verses[i].el.removeClass("sg-vsel");
          this.sel.verses.splice(i, 1);
        } else {
          el.addClass("sg-vsel");
          this.sel.verses.push({ verseId, verseText: this.verseTextOf(el), el });
          this.sel.verses.sort((a, b) => {
            const A2 = parseVerseId(a.verseId), B = parseVerseId(b.verseId);
            return A2.chapter - B.chapter || A2.verse - B.verse;
          });
        }
        this.render();
      }
      setPartial(verseId, verseText, selected) {
        for (const v of this.sel.verses) v.el.removeClass("sg-vsel");
        this.sel.verses = [];
        this.sel.partial = { verseId, verseText, selected };
        this.render();
      }
      clear() {
        trace("bar.clear", { hadPartial: !!this.sel.partial, verses: this.sel.verses.length });
        if (this.sel.partial) window.getSelection()?.removeAllRanges();
        for (const v of this.sel.verses) v.el.removeClass("sg-vsel");
        this.sel = { verses: [], partial: null };
        this.render();
      }
      get active() {
        return this.sel.verses.length > 0 || this.sel.partial !== null;
      }
      refLabel() {
        if (this.sel.partial) return verseDisplay(this.sel.partial.verseId) ?? this.sel.partial.verseId;
        const vs = this.sel.verses;
        if (!vs.length) return "";
        const first = verseDisplay(vs[0].verseId) ?? vs[0].verseId;
        if (vs.length === 1) return first;
        const last = parseVerseId(vs[vs.length - 1].verseId);
        return `${first}\u2013${last.verse}`;
      }
      // ------------------------------------------------------------ action bar
      render() {
        document.body.toggleClass("sg-selecting", this.active);
        if (!this.active) {
          this.barEl?.remove();
          this.barEl = null;
          this.lastSig = "";
          return;
        }
        const scope = this.s.device.lastShareScope;
        const sig = JSON.stringify([
          this.sel.verses.map((v) => v.verseId),
          this.sel.partial?.selected,
          scope,
          this.s.device.lastColor,
          this.s.device.lastStyle,
          this.s.device.lastTheme,
          (this.s.settings.themes ?? []).length
        ]);
        if (sig === this.lastSig && this.barEl) return;
        this.lastSig = sig;
        if (!this.barEl) {
          this.barEl = document.body.createDiv({ cls: "sg-studybar" });
        }
        const bar = this.barEl;
        bar.empty();
        const top = bar.createDiv({ cls: "sg-studybar-top" });
        top.createSpan({ cls: "sg-studybar-ref", text: this.refLabel() });
        const scopeChip = top.createEl("button", {
          cls: "sg-scope-chip",
          text: scope.visibility === "group" ? `\u{1F465} ${this.s.groups.find((g) => g.group_id === scope.groupId)?.name ?? "Group"}` : SCOPE_LABEL[scope.visibility] ?? "\u{1F510} Only me"
        });
        scopeChip.onclick = (e) => this.pickScope(e);
        const graphBtn = top.createEl("button", { cls: "sg-graph-btn", text: "\u{1F578}" });
        graphBtn.setAttribute("aria-label", "See this verse's connections graph");
        graphBtn.onclick = () => void this.openGraph();
        const close = top.createEl("button", { cls: "sg-studybar-x", text: "\u2715" });
        close.onclick = () => this.clear();
        const colors = bar.createDiv({ cls: "sg-studybar-colors" });
        for (const c of COLORS) {
          const dot = colors.createEl("button", { cls: `sg-dot sg-dot-${c}` });
          dot.style.backgroundColor = COLOR_HEX[c] ?? "#f5d90a";
          if (c === this.s.device.lastColor) {
            dot.addClass("sg-dot-last");
            dot.style.borderColor = "var(--text-normal)";
          }
          dot.setAttribute("aria-label", `Mark ${c}`);
          dot.onclick = () => void this.doHighlight(c);
        }
        const styles = [
          ["highlight", "\u{1F58D}"],
          ["underline", "U\u0332"],
          ["bold", "B"],
          ["italic", "I"]
        ];
        for (const [key, label] of styles) {
          const chip = colors.createEl("button", { cls: "sg-style-chip", text: label });
          if (key === "bold") chip.style.fontWeight = "800";
          if (key === "italic") chip.style.fontStyle = "italic";
          if (key === (this.s.device.lastStyle || "highlight")) chip.addClass("sg-style-on");
          chip.setAttribute("aria-label", `${key} style`);
          chip.onclick = () => {
            this.s.device.lastStyle = key;
            this.s.device.lastTheme = null;
            void this.s.saveDevice();
            this.render();
          };
        }
        const trow = bar.createDiv({ cls: "sg-studybar-themes" });
        const customs = (this.s.settings.themes ?? []).filter((t) => !THEME_LIBRARY.some((l) => l.name.toLowerCase() === t.name.toLowerCase())).map((t) => themeSpec(t.name, this.s.settings.themes ?? [], COLOR_HEX));
        const chipByName = /* @__PURE__ */ new Map();
        for (const sp of [...THEME_LIBRARY, ...customs]) {
          const chip = trow.createEl("button", {
            cls: "sg-theme-chip",
            text: `${sp.emoji} ${sp.name}`
          });
          chip.style.borderBottom = `3px solid ${sp.c1}`;
          chipByName.set(sp.name.toLowerCase(), chip);
          chip.onclick = () => void this.doTheme(sp);
        }
        const add = trow.createEl("button", { cls: "sg-theme-chip sg-theme-add", text: "\uFF0B own" });
        add.onclick = () => this.saveThemePrompt();
        void this.markActiveThemeChips(chipByName);
        const row = bar.createDiv({ cls: "sg-studybar-actions" });
        const act = (label, fn) => {
          const b = row.createEl("button", { text: label });
          b.onclick = fn;
        };
        act("\u{1F4DD} Note", () => this.doNote());
        act("\u{1F0CF} Card", () => void this.doFlashcard());
        act("\u{1F4CB} Copy", () => void this.doCopy());
        act("\u2728 Ask AI", () => this.doAsk());
      }
      pickScope(e) {
        const menu = new import_obsidian7.Menu();
        const set = (visibility, groupId, label) => {
          this.s.device.lastShareScope = { visibility, groupId };
          void this.s.saveDevice();
          new import_obsidian7.Notice(`New marks: ${label}`);
          this.render();
        };
        menu.addItem((i) => i.setTitle("\u{1F510} Only me (synced)").onClick(() => set("private", null, "only you")));
        menu.addItem((i) => i.setTitle("\u{1F512} Only me (this device)").onClick(() => set("local", null, "this device only")));
        for (const g of this.s.groups) {
          menu.addItem((i) => i.setTitle(`\u{1F465} ${g.name}`).onClick(() => set("group", g.group_id, g.name)));
        }
        menu.addItem((i) => i.setTitle("\u{1F30E} Public").onClick(() => set("public", null, "public")));
        menu.showAtMouseEvent(e);
      }
      async doHighlight(color) {
        const { visibility, groupId } = this.s.device.lastShareScope;
        const style = this.s.device.lastStyle ?? "highlight";
        this.s.device.lastColor = color;
        void this.s.saveDevice();
        if (this.sel.partial) {
          const p = this.sel.partial;
          await this.ann.addHighlight(
            p.verseId,
            color,
            p.verseText,
            p.selected,
            visibility,
            groupId,
            style,
            null
          );
        } else {
          for (const v of this.sel.verses) {
            await this.ann.addHighlight(
              v.verseId,
              color,
              v.verseText,
              null,
              visibility,
              groupId,
              style,
              null
            );
          }
        }
        new import_obsidian7.Notice(`Marked ${this.refLabel()}`);
        this.clear();
      }
      /** connections graph for the selected verse's chapter */
      async openGraph() {
        const vid = this.targetVerseIds()[0];
        if (!vid) return;
        const r = parseVerseId(vid);
        const title = r ? chapterTitle(r.bookSlug, r.chapter) : null;
        this.clear();
        await openLocalGraphFor(this.s, title);
      }
      /** verses this action targets — themes are WHOLE-VERSE by design, so a
       * phrase selection resolves to its verse */
      targetVerseIds() {
        if (this.sel.partial) return [this.sel.partial.verseId];
        return this.sel.verses.map((v) => v.verseId);
      }
      /** apply/remove a theme tag on every selected verse (stackable) */
      async doTheme(spec) {
        const { visibility, groupId } = this.s.device.lastShareScope;
        const ids = this.targetVerseIds();
        if (!ids.length) return;
        let added = 0, removed = 0;
        for (const vid of ids) {
          const on = await this.ann.toggleTheme(vid, spec.name, spec.c1, visibility, groupId);
          if (on) added++;
          else removed++;
        }
        trace("theme.toggle", { theme: spec.name, added, removed });
        new import_obsidian7.Notice(added && !removed ? `${spec.emoji} ${spec.name} \u2014 ${this.refLabel()}` : !added && removed ? `${spec.emoji} ${spec.name} removed` : `${spec.emoji} ${spec.name} updated`);
        this.clear();
      }
      /** ring the chips whose theme the (first) selected verse already carries */
      async markActiveThemeChips(chips) {
        const vid = this.targetVerseIds()[0];
        if (!vid) return;
        const mine = await this.ann.mine(vid);
        for (const a of mine) {
          if (a.annotation_type === "highlight" && a.theme && !a.selected_text) {
            chips.get(a.theme.toLowerCase())?.addClass("sg-style-on");
          }
        }
      }
      /** name the current color+treatment as a shared family theme */
      saveThemePrompt() {
        const color = this.s.device.lastColor;
        const style = this.s.device.lastStyle || "highlight";
        new ThemeNameModal(this.s, color, async (name) => {
          const themes = this.s.settings.themes ?? [];
          const existing = themes.findIndex((t) => t.name.toLowerCase() === name.toLowerCase());
          const entry = { name, color, style };
          if (existing >= 0) themes[existing] = entry;
          else themes.push(entry);
          this.s.applySettings({ themes });
          await this.saveSettings();
          new import_obsidian7.Notice(`Theme \u201C${name}\u201D added to the family library`);
          this.lastSig = "";
          this.render();
        }).open();
      }
      doNote() {
        const ref = this.refLabel();
        const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId;
        const quoted = this.sel.partial?.selected ?? null;
        if (!anchor) return;
        const { visibility, groupId } = this.s.device.lastShareScope;
        new NoteModal(this.s, ref, (text) => {
          const body = this.sel.verses.length > 1 ? `(${ref}) ${text}` : text;
          void this.ann.addNote(anchor, body, quoted, visibility, groupId);
          new import_obsidian7.Notice(`Note saved \u2014 ${ref}`);
          this.clear();
        }).open();
      }
      async doFlashcard() {
        const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId;
        if (!anchor) return;
        const back = this.sel.partial?.selected ?? this.sel.verses.map((v) => v.verseText).join(" ");
        const ref = this.refLabel();
        await this.study.addFlashcard(`What does ${ref} say?`, back.slice(0, 600), anchor);
        this.clear();
      }
      async doCopy() {
        const ref = this.refLabel();
        const text = this.sel.partial?.selected ?? this.sel.verses.map((v) => v.verseText).join("\n");
        try {
          await navigator.clipboard.writeText(`"${text}"
\u2014 ${ref}`);
          new import_obsidian7.Notice(`Copied ${ref}`);
        } catch {
          new import_obsidian7.Notice("Copy failed");
        }
        this.clear();
      }
      doAsk() {
        const anchor = this.sel.partial?.verseId ?? this.sel.verses[0]?.verseId ?? null;
        const seed = this.sel.partial ? `About "${this.sel.partial.selected}" \u2014 ` : "";
        this.clear();
        this.openAsk(seed, anchor);
      }
    };
    ThemeNameModal = class extends import_obsidian7.Modal {
      constructor(s, desc, onSave) {
        super(s.app);
        this.desc = desc;
        this.onSave = onSave;
      }
      onOpen() {
        this.contentEl.createEl("h3", { text: "Name this theme" });
        this.contentEl.createEl("p", {
          text: `Current look: ${this.desc}. Themes are shared with the family \u2014 e.g. "Faith", "Covenants", "Promises".`
        });
        let name = "";
        new import_obsidian7.Setting(this.contentEl).setName("Theme name").addText((t) => t.setPlaceholder("Faith").onChange((v) => name = v));
        new import_obsidian7.Setting(this.contentEl).addButton((b) => b.setButtonText("Save theme").setCta().onClick(() => {
          const n = name.trim().slice(0, 40);
          if (!n) return;
          this.close();
          this.onSave(n);
        }));
      }
      onClose() {
        this.contentEl.empty();
      }
    };
  }
});

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => SGPlugin,
  newerVersion: () => newerVersion
});
module.exports = __toCommonJS(main_exports);
var import_obsidian12 = require("obsidian");
init_src();

// src/state.ts
var import_obsidian = require("obsidian");
init_src();
var CANONICAL_PREFIX = "AI Library/01 Scriptures/Canonical/";
var LIBRARY_PREFIX = "AI Library/";
var PERSONAL_PREFIX = "Library/";
var DEFAULT_SHARED = {
  serverUrl: "http://127.0.0.1:8930",
  defaultVisibility: "private",
  forceLibraryPreview: true,
  chapterLinksToMyStudy: true,
  themes: []
};
var DEFAULT_DEVICE = {
  deviceToken: null,
  userId: null,
  displayName: null,
  openrouterKey: null,
  aiTier: "auto",
  aiSpecificModel: null,
  aiUsePersonalNotes: false,
  showScopes: { mine: true, groups: {}, public: false },
  aiDepth: "balanced",
  lastShareScope: { visibility: "private", groupId: null },
  lastColor: "yellow",
  lastStyle: "highlight",
  lastTheme: null,
  debugOverlay: false
};
var SGState = class {
  constructor(app, plugin) {
    this.app = app;
    this.plugin = plugin;
    const ns = `sg:${app.appId ?? "vault"}`;
    this.store = new WebStorage(ns, globalThis.localStorage);
    this.sync = new SyncEngine(this.store);
    this.budget = new Budget(this.store);
    const fetchLike = async (url, init) => {
      const res = await (0, import_obsidian.requestUrl)({
        url,
        method: init.method,
        headers: init.headers,
        body: init.body,
        throw: false
      });
      return {
        status: res.status,
        json: async () => {
          try {
            return res.json;
          } catch {
            return {};
          }
        }
      };
    };
    this.api = new ApiClient(DEFAULT_SHARED.serverUrl, fetchLike, null);
  }
  settings = { ...DEFAULT_SHARED };
  device = { ...DEFAULT_DEVICE };
  store;
  sync;
  budget;
  api;
  modelRegistry = [];
  groups = [];
  /** anchor_id -> social annotations from the last query (others' shared) */
  socialCache = /* @__PURE__ */ new Map();
  onChange = [];
  async loadDevice() {
    const d = await this.store.get("device");
    if (d) this.device = { ...DEFAULT_DEVICE, ...d };
    this.api.setToken(this.device.deviceToken);
  }
  async saveDevice() {
    await this.store.put("device", this.device);
    this.api.setToken(this.device.deviceToken);
  }
  applySettings(s) {
    this.settings = { ...DEFAULT_SHARED, ...this.settings, ...s };
    this.api.baseUrl = this.settings.serverUrl;
  }
  get signedIn() {
    return !!this.device.deviceToken;
  }
  get aiConnected() {
    return !!this.device.openrouterKey;
  }
  notify() {
    for (const f of this.onChange) {
      try {
        f();
      } catch {
      }
    }
  }
  /** set by AnnotationService: re-decorates rendered verses IN PLACE */
  redecorate = null;
  /** Marks appear/disappear the moment anything changes. Decoration happens
   * in place on the existing DOM — a full markdown re-render would reset the
   * reading position to the top of the file (user-reported bug). */
  rerenderReading() {
    this.notify();
    void this.redecorate?.();
  }
};

// src/main.ts
init_annotations();

// src/social/readingIntegration.ts
var import_obsidian3 = require("obsidian");
init_annotations();
function registerReadingIntegration(plugin, s, svc, bar, openAsk) {
  plugin.registerMarkdownPostProcessor(async (el, ctx) => {
    if (!ctx.sourcePath?.startsWith(CANONICAL_PREFIX)) return;
    const fm = plugin.app.metadataCache.getCache(ctx.sourcePath)?.frontmatter;
    const slug = fm?.slug;
    if (!slug) return;
    const anchors = [];
    const paragraphs = [];
    el.querySelectorAll("p").forEach((p) => {
      const strong = p.querySelector("strong");
      const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
      if (!Number.isFinite(n)) return;
      const verseId = `${slug}-${n}`;
      p.setAttribute("data-verse-id", verseId);
      anchors.push(verseId);
      paragraphs.push({ p, verseId });
    });
    for (const { p, verseId } of paragraphs) {
      const mine = await svc.mine(verseId);
      decorateVerse(s, svc, p, verseId, mine, svc.social(verseId));
    }
    void svc.refreshSocial(anchors);
  });
  bar.attach(plugin);
  plugin.registerDomEvent(document, "contextmenu", (evt) => {
    const hit = resolveSelection(s, evt);
    if (!hit) return;
    evt.preventDefault();
    evt.stopPropagation();
    buildSelectionMenu(s, svc, hit, openAsk).showAtMouseEvent(evt);
  });
}
function resolveSelection(s, evt) {
  const sel = window.getSelection();
  let target = evt?.target instanceof Element ? evt.target : null;
  if (!target && sel?.anchorNode) {
    target = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode.parentElement;
  }
  if (!target || target.closest(".cm-editor")) return null;
  if (!target.closest(".markdown-preview-view, .markdown-embed, .sg-reader")) return null;
  const p = target.closest("p") ?? sel?.anchorNode?.parentElement?.closest("p") ?? null;
  if (!p) return null;
  const direct = p.getAttribute("data-verse-id") ?? target.closest("[data-verse-id]")?.getAttribute("data-verse-id");
  let verseId = direct ?? null;
  if (!verseId) {
    const embed = target.closest(".internal-embed[src]");
    const src = embed?.getAttribute("src") ?? null;
    if (src?.includes("#^")) verseId = src.split("#^")[1].trim();
    else {
      const strong = p.querySelector("strong");
      const n = strong ? parseInt(strong.textContent ?? "", 10) : NaN;
      if (!Number.isFinite(n)) return null;
      let slug = null;
      if (src) {
        const dest = s.app.metadataCache.getFirstLinkpathDest(src.split("#")[0], "");
        if (dest && !dest.path.startsWith(CANONICAL_PREFIX)) return null;
        slug = dest ? s.app.metadataCache.getFileCache(dest)?.frontmatter?.slug ?? null : null;
      } else {
        const f = s.app.workspace.getActiveFile();
        if (!f || !f.path.startsWith(CANONICAL_PREFIX)) return null;
        slug = s.app.metadataCache.getFileCache(f)?.frontmatter?.slug ?? null;
      }
      if (!slug) return null;
      verseId = `${slug}-${n}`;
    }
  }
  if (!verseId || verseId.split("-").length < 3) return null;
  const selected = sel && !sel.isCollapsed ? sel.toString().trim() : null;
  const clone = p.cloneNode(true);
  clone.querySelectorAll(".sgh-note-icon, .sg-badge").forEach((e) => e.remove());
  const verseText = (clone.textContent ?? "").replace(/^\s*\d+\s*/, "").trim() || null;
  return {
    verseId,
    verseText: verseText ?? "",
    selected: selected && selected.length >= 3 && selected.length <= 600 ? selected : null
  };
}
function buildSelectionMenu(s, svc, hit, openAsk) {
  const menu = new import_obsidian3.Menu();
  menu.addItem((i) => i.setTitle("View notes on this verse").setIcon("sticky-note").onClick(() => new NotesPopover(s, svc, hit.verseId).open()));
  menu.addSeparator();
  for (const c of COLORS) {
    menu.addItem((i) => i.setTitle(`Highlight ${c}`).setIcon("highlighter").onClick((e) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addHighlight(hit.verseId, c, hit.verseText, hit.selected, vis, gid);
        new import_obsidian3.Notice(`Highlighted \u2014 ${label}`);
      }).showAtMouseEvent(e);
    }));
  }
  menu.addSeparator();
  menu.addItem((i) => i.setTitle("Add note\u2026").setIcon("pencil").onClick(() => {
    new NoteModal(s, hit.verseId, (text) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addNote(hit.verseId, text, hit.selected, vis, gid);
        new import_obsidian3.Notice(`Note saved \u2014 ${label}`);
      }).showAtPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    }).open();
  }));
  menu.addSeparator();
  menu.addItem((i) => i.setTitle("\u2728 Ask AI about this verse").setIcon("sparkles").onClick(() => {
    openAsk(hit.selected ? `About "${hit.selected}" \u2014 ` : "", hit.verseId);
  }));
  return menu;
}

// src/social/onboarding.ts
var import_obsidian4 = require("obsidian");
var WelcomeModal = class extends import_obsidian4.Modal {
  constructor(s, ai, onDone) {
    super(s.app);
    this.s = s;
    this.ai = ai;
    this.onDone = onDone;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("sg-welcome");
    contentEl.createEl("h2", { text: "Welcome to Scripture Graph" });
    contentEl.createEl("p", {
      text: "\u2713 Shared scriptures  \u2713 Family highlights  \u2713 Truly private notes  \u2713 Study tools"
    });
    let invite = "";
    let name = "";
    let device = "My device";
    new import_obsidian4.Setting(contentEl).setName("Your name").addText((t) => t.setPlaceholder("e.g. Mom").onChange((v) => name = v));
    new import_obsidian4.Setting(contentEl).setName("Invite code").setDesc("From the family member who runs Scripture Graph").addText((t) => t.setPlaceholder("XXXX-XXXX-XXXX").onChange((v) => invite = v));
    new import_obsidian4.Setting(contentEl).setName("This device").addText((t) => t.setValue(device).onChange((v) => device = v || "My device"));
    new import_obsidian4.Setting(contentEl).addButton((b) => b.setButtonText("Join").setCta().onClick(async () => {
      const code = invite.trim();
      if (!code) return void new import_obsidian4.Notice("Invite code required");
      if (code.startsWith("sgd_")) {
        try {
          this.s.device.deviceToken = code;
          await this.s.saveDevice();
          const me = await this.s.api.me();
          this.s.device.userId = me.user.user_id;
          this.s.device.displayName = me.user.display_name;
          await this.s.saveDevice();
          await refreshIdentity(this.s);
          new import_obsidian4.Notice(`Welcome, ${me.user.display_name}!`);
          this.close();
          this.maybeOfferAi();
        } catch (e) {
          this.s.device.deviceToken = null;
          await this.s.saveDevice();
          new import_obsidian4.Notice(`Token rejected: ${e.message}`);
        }
        return;
      }
      if (!name.trim()) return void new import_obsidian4.Notice("Name and invite code required");
      try {
        const session = await this.s.api.claim(code, name.trim(), device);
        this.s.device.deviceToken = session.token;
        this.s.device.userId = session.user.user_id;
        this.s.device.displayName = session.user.display_name;
        await this.s.saveDevice();
        await refreshIdentity(this.s);
        new import_obsidian4.Notice(`Welcome, ${session.user.display_name}!`);
        this.close();
        this.maybeOfferAi();
      } catch (e) {
        try {
          const session = await linkDevice(this.s, invite.trim(), device);
          new import_obsidian4.Notice(`Welcome back, ${session.display_name}!`);
          this.close();
          this.maybeOfferAi();
        } catch {
          new import_obsidian4.Notice(`Could not join: ${e.message}`);
        }
      }
    })).addButton((b) => b.setButtonText("Maybe later").onClick(() => this.close()));
  }
  maybeOfferAi() {
    const m = new import_obsidian4.Modal(this.app);
    m.contentEl.createEl("h3", { text: "Want AI features?" });
    m.contentEl.createEl("p", {
      text: "Ask questions about any verse using YOUR OWN AI balance (about $10 goes far). Everything else works without it."
    });
    new import_obsidian4.Setting(m.contentEl).addButton((b) => b.setButtonText("Connect AI").setCta().onClick(async () => {
      m.close();
      await this.ai.beginConnect();
      new import_obsidian4.Notice("Complete the authorization in your browser \u2014 Obsidian will catch the redirect.");
    })).addButton((b) => b.setButtonText("Maybe later").onClick(() => m.close()));
    m.open();
    this.onDone();
  }
  onClose() {
    this.contentEl.empty();
  }
};
async function linkDevice(s, code, deviceName) {
  const session = await s.api.linkDevice(code, deviceName);
  s.device.deviceToken = session.token;
  s.device.userId = session.user.user_id;
  s.device.displayName = session.user.display_name;
  await s.saveDevice();
  await refreshIdentity(s);
  return session.user;
}
async function refreshIdentity(s) {
  if (!s.signedIn) return;
  try {
    const me = await s.api.me();
    s.groups = me.groups ?? [];
    for (const g of s.groups) {
      if (!(g.group_id in s.device.showScopes.groups)) {
        s.device.showScopes.groups[g.group_id] = true;
      }
    }
    await s.saveDevice();
    s.notify();
  } catch {
  }
}

// src/ai/aiService.ts
var import_obsidian5 = require("obsidian");
init_src();
var CALLBACK_URL = "obsidian://scripture-graph-auth";
var AiService = class {
  constructor(s) {
    this.s = s;
  }
  pendingVerifier = null;
  // ------------------------------------------------------------- connect
  async beginConnect() {
    this.pendingVerifier = makeVerifier();
    const challenge = await challengeS256(this.pendingVerifier);
    const url = authUrl(CALLBACK_URL, challenge);
    window.open(url);
    return url;
  }
  /** called by the obsidian:// protocol handler OR manual code paste */
  async completeConnect(code) {
    if (!this.pendingVerifier) throw new Error("no pending AI connection \u2014 start again");
    const key = await exchangeCode(code.trim(), this.pendingVerifier);
    this.pendingVerifier = null;
    this.s.device.openrouterKey = key;
    await this.s.saveDevice();
    new import_obsidian5.Notice("AI connected \u2713 (your own OpenRouter wallet)");
    this.s.notify();
  }
  async disconnect() {
    this.s.device.openrouterKey = null;
    await this.s.saveDevice();
    this.s.notify();
  }
  // -------------------------------------------------------------- models
  async models(force = false) {
    if (this.s.modelRegistry.length && !force) return this.s.modelRegistry;
    const cached = await this.s.store.get("model_registry");
    if (cached && !force && Date.now() - cached.at < 24 * 36e5) {
      this.s.modelRegistry = cached.models;
      return cached.models;
    }
    const models = await listModels();
    this.s.modelRegistry = models;
    await this.s.store.put("model_registry", { at: Date.now(), models });
    return models;
  }
  async wallet() {
    if (!this.s.device.openrouterKey) return null;
    try {
      return await keyStatus(this.s.device.openrouterKey);
    } catch {
      return null;
    }
  }
  // ----------------------------------------------------------------- ask
  async ask(task, messages, onDelta, signal) {
    const key = this.s.device.openrouterKey;
    if (!key) throw new Error("AI is not connected yet \u2014 Settings \u2192 Scripture Graph \u2192 Connect AI");
    const gate = await this.s.budget.mayStart();
    if (!gate.ok) {
      throw new Error(
        `Monthly AI cap reached ($${gate.s.spentUsd.toFixed(2)} of $${gate.s.capUsd.toFixed(2)}). Raise the cap in settings to continue.`
      );
    }
    const registry = await this.models();
    const choice = pickModel(registry, task, {
      tier: this.s.device.aiTier,
      specificModel: this.s.device.aiSpecificModel
    });
    const res = await chat(key, choice.modelId, messages, { onDelta, signal });
    await this.s.budget.addUsage(res.usage.costUsd);
    return { text: res.text, model: choice.modelId, costUsd: res.usage.costUsd };
  }
};

// src/ai/askView.ts
var import_obsidian6 = require("obsidian");

// src/ai/context.ts
init_src();
async function read(s, file) {
  return s.app.vault.cachedRead(file);
}
function fileByTitle(s, title) {
  return s.app.metadataCache.getFirstLinkpathDest(title, "") ?? null;
}
async function chapterContext(s, chapterTitle2, verseId, items) {
  const canonical = fileByTitle(s, chapterTitle2);
  if (canonical && canonical.path.startsWith(CANONICAL_PREFIX)) {
    const { body } = parseFrontmatter(await read(s, canonical));
    const verses = parseCanonicalVerses(body);
    if (verseId) {
      const target = verses.find((v) => v.verseId === verseId);
      const near = verses.filter((v) => target && Math.abs(v.verse - target.verse) <= 3);
      if (target) {
        items.push({
          label: `Verse ${verseDisplay(verseId)}`,
          wikilink: chapterTitle2,
          text: `${verseDisplay(verseId)}: ${target.text}`,
          priority: 0
        });
        items.push({
          label: "Nearby verses",
          wikilink: chapterTitle2,
          text: near.map((v) => `${v.verse}. ${v.text}`).join("\n"),
          priority: 1
        });
      }
    }
    items.push({
      label: `${chapterTitle2} (full text)`,
      wikilink: chapterTitle2,
      text: verses.map((v) => `${v.verse}. ${v.text}`).join("\n"),
      priority: verseId ? 4 : 1
    });
  }
  const guide = fileByTitle(s, `${chapterTitle2} - Study Guide`);
  if (guide) {
    const { body } = parseFrontmatter(await read(s, guide));
    const secs = sections(body);
    const keep = [
      "overview",
      "structure",
      "doctrines",
      "related-scriptures",
      "topics",
      "language",
      "literary",
      "evidence",
      "conference",
      "history"
    ];
    const text = keep.filter((k) => !sectionIsEmpty(secs[k])).map((k) => `### ${k}
${secs[k]}`).join("\n\n");
    if (text) {
      items.push({
        label: `${chapterTitle2} Study Guide`,
        wikilink: `${chapterTitle2} - Study Guide`,
        text,
        priority: 2
      });
      const links = extractWikilinks(secs["related-scriptures"] ?? "").concat(extractWikilinks(secs["evidence"] ?? ""));
      const seen = /* @__PURE__ */ new Set();
      let n = 0;
      for (const l of links) {
        if (seen.has(l.target) || l.target === chapterTitle2) continue;
        seen.add(l.target);
        if (++n > 6) break;
        const f = fileByTitle(s, l.target);
        if (!f || !f.path.startsWith(LIBRARY_PREFIX)) continue;
        const { body: rb } = parseFrontmatter(await read(s, f));
        const rSecs = sections(rb);
        const summary = rSecs["summary"] ?? rSecs["overview"] ?? rb.slice(0, 1500);
        items.push({
          label: l.target,
          wikilink: l.target,
          text: summary.slice(0, 2500),
          priority: 5
        });
      }
    }
  }
}
async function personalContext(s, anchorPrefix, items, annotations) {
  const rel = annotations.filter((a) => a.anchor_id.startsWith(anchorPrefix) && a.content && !a.deleted_at);
  if (!rel.length) return;
  items.push({
    label: "My private notes (user-permitted)",
    wikilink: null,
    text: rel.map((a) => `- [${verseDisplay(a.anchor_id) ?? a.anchor_id}] ${a.content}`).join("\n"),
    priority: 3
  });
}
async function vaultSearch(s, question, items) {
  const refs = findScriptureRefs(question);
  for (const r of refs.slice(0, 3)) {
    const title = chapterTitle(r.bookSlug, r.chapter);
    if (title) await chapterContext(s, title, null, items);
  }
  const terms = question.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 3);
  if (!terms.length) return;
  const files = s.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith(LIBRARY_PREFIX));
  const scored = [];
  for (const f of files) {
    const name = f.basename.toLowerCase();
    let score = 0;
    for (const t of terms) if (name.includes(t)) score += 3;
    const cache = s.app.metadataCache.getFileCache(f);
    const aliases = cache?.frontmatter?.["aliases"] ?? [];
    for (const a of aliases) for (const t of terms) {
      if (String(a).toLowerCase().includes(t)) score += 2;
    }
    if (score > 0) scored.push({ f, score });
  }
  scored.sort((a, b) => b.score - a.score);
  for (const { f } of scored.slice(0, 8)) {
    const { body } = parseFrontmatter(await read(s, f));
    const secs = sections(body);
    const text = Object.values(secs).filter((v) => !sectionIsEmpty(v)).join("\n\n") || body.slice(0, 2e3);
    items.push({ label: f.basename, wikilink: f.basename, text: text.slice(0, 3e3), priority: 4 });
  }
}
async function assembleContext(s, question, anchor, personal) {
  const items = [];
  if (anchor?.chapterTitle) {
    await chapterContext(s, anchor.chapterTitle, anchor.verseId, items);
  } else {
    await vaultSearch(s, question, items);
  }
  if (s.device.aiUsePersonalNotes && anchor?.chapterTitle) {
    const slug = anchor.verseId ? anchor.verseId.split("-").slice(0, 2).join("-") : null;
    if (slug) await personalContext(s, slug, items, personal);
  }
  const trimmed = trimContext(items, s.device.aiDepth);
  const systemPrompt = "You are Scripture Graph's study assistant. Answer FROM THE PROVIDED CONTEXT first; say plainly when the context is insufficient rather than improvising. Distinguish observation from interpretation from evidentiary significance. Cite sources as Obsidian wikilinks exactly as given in the context labels, e.g. [[Alma 36]] or [[Chiasmus in Alma 36]] \u2014 never invent note titles. Be honest about evidence strength; never manufacture certainty.";
  return { items: trimmed, systemPrompt };
}
function contextToMessages(ctx, question) {
  const contextBlock = ctx.items.map((i) => `--- ${i.label}${i.wikilink ? ` [[${i.wikilink}]]` : ""} ---
${i.text}`).join("\n\n");
  return [
    { role: "system", content: ctx.systemPrompt },
    { role: "user", content: `CONTEXT:

${contextBlock}

QUESTION: ${question}` }
  ];
}

// src/ai/askView.ts
var ASK_VIEW = "scripture-graph-ask";
var ACTION_PRESETS = [
  { label: "Explain", task: "verse", template: (a) => `Explain ${a} clearly for serious study.` },
  { label: "Connections", task: "connections", template: (a) => `What are the most meaningful connections to ${a} across the scriptures and this vault?` },
  { label: "Historical context", task: "history", template: (a) => `What is the historical context of ${a}?` },
  { label: "Language & text", task: "language", template: (a) => `What language, translation, or textual observations matter in ${a}?` },
  { label: "Evidence", task: "evidence", template: (a) => `What evidence and honest counter-considerations relate to ${a}?` },
  { label: "Challenge it", task: "challenge", template: (a) => `Give the strongest skeptical reading of ${a}, then the strongest response.` }
];
var AskView = class extends import_obsidian6.ItemView {
  constructor(leaf, s, ai, ann) {
    super(leaf);
    this.s = s;
    this.ai = ai;
    this.ann = ann;
  }
  turns = [];
  anchorChapter = null;
  anchorVerse = null;
  busy = false;
  inputEl;
  logEl;
  headerEl;
  getViewType() {
    return ASK_VIEW;
  }
  getDisplayText() {
    return "Ask Scripture Graph";
  }
  getIcon() {
    return "sparkles";
  }
  setAnchor(chapterTitle2, verseId, seed) {
    this.anchorChapter = chapterTitle2;
    this.anchorVerse = verseId;
    this.renderHeader();
    if (seed !== void 0) this.inputEl.value = seed;
    this.inputEl.focus();
  }
  async onOpen() {
    const root = this.contentEl;
    root.empty();
    root.addClass("sg-ask");
    this.headerEl = root.createDiv({ cls: "sg-ask-header" });
    this.logEl = root.createDiv({ cls: "sg-ask-log" });
    const presets = root.createDiv({ cls: "sg-ask-presets" });
    for (const p of ACTION_PRESETS) {
      const b = presets.createEl("button", { text: p.label });
      b.onclick = () => {
        const a = this.anchorVerse ? this.anchorVerse.replace(/^(.*)-(\d+)-(\d+)$/, () => `${this.anchorChapter}:${this.anchorVerse.split("-").pop()}`) : this.anchorChapter ?? "this passage";
        void this.send(p.template(a), p.task);
      };
    }
    const inputRow = root.createDiv({ cls: "sg-ask-input" });
    this.inputEl = inputRow.createEl("textarea", {
      attr: { placeholder: "Ask about this passage \u2014 or anything in your vault\u2026" }
    });
    const send = inputRow.createEl("button", { text: "Ask" });
    send.onclick = () => void this.send(
      this.inputEl.value.trim(),
      this.anchorChapter ? "verse" : "vault"
    );
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        void this.send(this.inputEl.value.trim(), this.anchorChapter ? "verse" : "vault");
      }
    });
    this.renderHeader();
    this.renderStatusLine();
  }
  renderHeader() {
    if (!this.headerEl) return;
    this.headerEl.empty();
    const scope = this.anchorVerse ? `${this.anchorChapter} \xB7 verse ${this.anchorVerse.split("-").pop()}` : this.anchorChapter ?? "Entire vault";
    this.headerEl.createSpan({ text: `Context: ${scope}` });
    const depth = this.headerEl.createEl("select");
    for (const d of ["focused", "balanced", "deep"]) {
      const o = depth.createEl("option", { text: d[0].toUpperCase() + d.slice(1), value: d });
      if (d === this.s.device.aiDepth) o.selected = true;
    }
    depth.onchange = () => {
      this.s.device.aiDepth = depth.value;
      void this.s.saveDevice();
    };
    if (this.anchorChapter) {
      const clear = this.headerEl.createEl("button", { text: "whole vault" });
      clear.onclick = () => this.setAnchor(null, null);
    }
  }
  async renderStatusLine() {
    const b = await this.s.budget.state();
    const el = this.logEl.createDiv({ cls: "sg-ask-status" });
    if (!this.s.aiConnected) {
      el.setText("AI not connected \u2014 open Settings \u2192 Scripture Graph \u2192 Connect AI. Everything else works without it.");
    } else {
      el.setText(`This month: $${b.spentUsd.toFixed(2)}${b.capUsd ? ` / $${b.capUsd.toFixed(2)}` : ""} \xB7 your own AI wallet`);
    }
  }
  async send(question, task) {
    if (!question || this.busy) return;
    this.busy = true;
    this.inputEl.value = "";
    this.turns.push({ role: "user", text: question });
    this.appendTurn({ role: "user", text: question });
    const answerEl = this.appendTurn({ role: "assistant", text: "\u2026" });
    try {
      const personal = this.s.device.aiUsePersonalNotes ? await this.s.sync.allAnnotations() : [];
      const ctx = await assembleContext(
        this.s,
        question,
        this.anchorChapter ? { chapterTitle: this.anchorChapter, verseId: this.anchorVerse } : null,
        personal
      );
      const built = contextToMessages(ctx, question);
      const history = this.turns.slice(0, -1).slice(-6).map((t) => ({ role: t.role, content: t.text }));
      const messages = [built[0], ...history, built[1]];
      let acc = "";
      const res = await this.ai.ask(task, messages, (delta) => {
        acc += delta;
        answerEl.setText(acc);
      });
      this.turns.push({ role: "assistant", text: res.text, model: res.model });
      await this.renderMarkdown(answerEl, res.text);
      const meta = answerEl.createDiv({ cls: "sg-ask-meta" });
      meta.setText(`${res.model} \xB7 ~$${res.costUsd.toFixed(4)}`);
      const save = meta.createEl("button", { text: "Save as note" });
      save.onclick = () => void this.saveAsNote(question, res.text);
      void this.renderStatusLine();
    } catch (e) {
      answerEl.setText(`\u26A0 ${e.message}`);
    } finally {
      this.busy = false;
    }
  }
  appendTurn(t) {
    const el = this.logEl.createDiv({ cls: `sg-turn sg-turn-${t.role}` });
    el.setText(t.text);
    el.scrollIntoView({ block: "end" });
    return el;
  }
  async renderMarkdown(el, text) {
    el.empty();
    await import_obsidian6.MarkdownRenderer.render(this.app, text, el, "", this);
  }
  /** §52: outputs become PERSONAL drafts, intentionally. */
  async saveAsNote(question, answer) {
    const folder = `${PERSONAL_PREFIX}AI Notes`;
    const name = question.slice(0, 60).replace(/[<>:"/\\|?*#^\[\]]/g, "").trim() || "AI note";
    const path = `${folder}/${name} (${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}).md`;
    try {
      if (!this.app.vault.getAbstractFileByPath(folder)) {
        await this.app.vault.createFolder(folder);
      }
      await this.app.vault.create(
        path,
        `---
ownership: personal
mutable: user
content_type: ai-conversation
---

# ${name}

**Q:** ${question}

${answer}
`
      );
      new import_obsidian6.Notice("Saved to Library/AI Notes");
    } catch (e) {
      new import_obsidian6.Notice(`Could not save: ${e.message}`);
    }
  }
};

// src/reader/readerView.ts
var import_obsidian8 = require("obsidian");
init_src();
init_annotations();
var READER_VIEW = "scripture-graph-reader";
var LENSES = [
  { key: "doctrine", icon: "\u{1F4D6}", label: "Doctrine", sections: ["overview", "doctrines", "topics"] },
  { key: "history", icon: "\u{1F3FA}", label: "History", sections: ["structure", "history"] },
  { key: "language", icon: "\u05D0", label: "Language", sections: ["language"] },
  { key: "literary", icon: "\u{1F500}", label: "Literary", sections: ["literary"] },
  { key: "evidence", icon: "\u{1F52C}", label: "Evidence", sections: ["evidence"] },
  { key: "conference", icon: "\u{1F399}", label: "Conference", sections: ["conference"] },
  { key: "related", icon: "\u{1F517}", label: "Related", sections: ["related-scriptures"] },
  { key: "media", icon: "\u{1F3A7}", label: "Media", sections: ["secondary-sources"] },
  { key: "questions", icon: "\u2753", label: "Questions", sections: ["questions", "further-study"] }
];
var ReaderView = class extends import_obsidian8.ItemView {
  constructor(leaf, s, ann, openAsk) {
    super(leaf);
    this.s = s;
    this.ann = ann;
    this.openAsk = openAsk;
  }
  chapterTitle = null;
  activeLenses = /* @__PURE__ */ new Set(["doctrine", "related"]);
  familyLens = true;
  getViewType() {
    return READER_VIEW;
  }
  getDisplayText() {
    return this.chapterTitle ?? "Scripture Graph";
  }
  getIcon() {
    return "book-open";
  }
  async setChapter(title) {
    this.chapterTitle = title;
    await this.render();
  }
  async onOpen() {
    this.contentEl.addClass("sg-reader");
    this.s.onChange.push(() => void this.render());
    if (this.chapterTitle) await this.render();
    else this.contentEl.createEl("p", { text: "Open a chapter with \u201COpen in Scripture Graph reader\u201D." });
  }
  canonicalFile() {
    if (!this.chapterTitle) return null;
    const f = this.app.metadataCache.getFirstLinkpathDest(this.chapterTitle, "");
    return f && f.path.startsWith(CANONICAL_PREFIX) ? f : null;
  }
  async render() {
    const root = this.contentEl;
    root.empty();
    const file = this.canonicalFile();
    if (!file || !this.chapterTitle) return;
    const raw = await this.app.vault.cachedRead(file);
    const { frontmatter, body } = parseFrontmatter(raw);
    const slug = String(frontmatter["slug"] ?? chapterIdFromTitle(this.chapterTitle) ?? "");
    const verses = parseCanonicalVerses(body);
    const bar = root.createDiv({ cls: "sg-reader-bar" });
    bar.createEl("h2", { text: this.chapterTitle });
    const graphBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "\u{1F578}" });
    graphBtn.setAttribute("aria-label", "Connections graph");
    graphBtn.onclick = () => {
      void Promise.resolve().then(() => (init_studyBar(), studyBar_exports)).then((m) => m.openLocalGraphFor(this.s, this.chapterTitle));
    };
    const myBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "\u270F\uFE0F My notes" });
    myBtn.onclick = () => {
      const companion = `${this.chapterTitle} - My Notes`;
      if (this.app.metadataCache.getFirstLinkpathDest(companion, "")) {
        void this.app.workspace.openLinkText(companion, "");
      }
    };
    const askBtn = bar.createEl("button", { cls: "sg-ask-btn", text: "\u2728 Ask AI" });
    askBtn.onclick = () => this.openAsk(this.chapterTitle, null);
    const lensBar = root.createDiv({ cls: "sg-lens-bar" });
    for (const l of LENSES) {
      const b = lensBar.createEl("button", {
        cls: `sg-lens ${this.activeLenses.has(l.key) ? "on" : ""}`,
        text: `${l.icon} ${l.label}`
      });
      b.onclick = () => {
        this.activeLenses.has(l.key) ? this.activeLenses.delete(l.key) : this.activeLenses.add(l.key);
        void this.render();
      };
    }
    const fam = lensBar.createEl("button", {
      cls: `sg-lens ${this.familyLens ? "on" : ""}`,
      text: "\u{1F465} Family"
    });
    fam.onclick = () => {
      this.familyLens = !this.familyLens;
      void this.render();
    };
    const scriptureEl = root.createDiv({ cls: "sg-reader-scripture" });
    const anchors = [];
    for (const v of verses) {
      anchors.push(v.verseId);
      const p = scriptureEl.createEl("p", { attr: { "data-verse-id": v.verseId } });
      p.createEl("strong", { text: String(v.verse) });
      p.appendText(" " + v.text);
      const mine = await this.ann.mine(v.verseId);
      const social = this.familyLens ? this.ann.social(v.verseId) : [];
      decorateVerse(this.s, this.ann, p, v.verseId, mine, social);
    }
    void this.ann.refreshSocial(anchors);
    const guide = this.app.metadataCache.getFirstLinkpathDest(
      `${this.chapterTitle} - Study Guide`,
      ""
    );
    if (guide) {
      const gBody = parseFrontmatter(await this.app.vault.cachedRead(guide)).body;
      const secs = sections(gBody);
      const secWrap = root.createDiv({ cls: "sg-reader-sections" });
      for (const l of LENSES) {
        if (!this.activeLenses.has(l.key)) continue;
        for (const name of l.sections) {
          const content = secs[name];
          if (sectionIsEmpty(content)) continue;
          const box = secWrap.createEl("details", { cls: "sg-section", attr: { open: "" } });
          box.createEl("summary", { text: `${l.icon} ${pretty(name)}` });
          const bodyEl = box.createDiv();
          await import_obsidian8.MarkdownRenderer.render(
            this.app,
            content,
            bodyEl,
            `${CANONICAL_PREFIX}x.md`,
            this
          );
        }
      }
    }
  }
};
function pretty(section) {
  return section.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// src/study/study.ts
var import_obsidian9 = require("obsidian");
init_src();
var StudyService = class {
  constructor(s, ann) {
    this.s = s;
    this.ann = ann;
  }
  trail = [];
  // ------------------------------------------------------------ trails
  recordVisit(file) {
    if (!file.path.startsWith("AI Library/")) return;
    const last = this.trail[this.trail.length - 1];
    if (last?.title === file.basename) return;
    this.trail.push({ title: file.basename, at: nowIso() });
    if (this.trail.length > 100) this.trail.shift();
  }
  async saveTrail() {
    if (this.trail.length < 2) return void new import_obsidian9.Notice("Trail is empty \u2014 study a little first");
    const name = `Trail ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`;
    const dlg = new NameModal(this.s, name, async (chosen) => {
      const folder = `${PERSONAL_PREFIX}Study Trails`;
      if (!this.s.app.vault.getAbstractFileByPath(folder)) {
        await this.s.app.vault.createFolder(folder);
      }
      const body = this.trail.map((t) => `- [[${t.title}]]`).join("\n");
      await this.s.app.vault.create(
        `${folder}/${chosen.replace(/[<>:"/\\|?*#^\[\]]/g, "")}.md`,
        `---
ownership: personal
mutable: user
content_type: study-trail
---

# ${chosen}

${body}
`
      );
      new import_obsidian9.Notice("Trail saved to Library/Study Trails");
      this.trail = [];
    });
    dlg.open();
  }
  // --------------------------------------------------------- bookmarks
  async bookmarkCurrent() {
    const f = this.s.app.workspace.getActiveFile();
    if (!f) return;
    let anchor = null;
    if (f.path.startsWith(CANONICAL_PREFIX)) anchor = chapterIdFromTitle(f.basename);
    if (!anchor) {
      const fm = this.s.app.metadataCache.getFileCache(f)?.frontmatter;
      const sgId = typeof fm?.["sg-id"] === "string" ? fm["sg-id"] : null;
      anchor = sgId ?? `node:${f.basename}`;
    }
    await this.ann.addNote(
      anchor,
      `Bookmark: [[${f.basename}]]`,
      null,
      this.s.settings.defaultVisibility === "local" ? "local" : "private",
      null
    );
    const all = await this.s.sync.allAnnotations();
    const latest = all.filter((a) => a.anchor_id === anchor).sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (latest) await this.s.sync.save({ ...latest, annotation_type: "bookmark" });
    this.s.rerenderReading();
    new import_obsidian9.Notice(`Bookmarked ${f.basename}`);
  }
  // -------------------------------------------------------- flashcards
  /** Idempotent: the same card (anchor + answer) is never added twice.
   * Comparison ignores punctuation/symbols so decoration glyphs or trailing
   * marks can never sneak a duplicate past the check. */
  async addFlashcard(front, back, anchor) {
    const norm = (t) => t.normalize("NFKD").replace(/[^\p{L}\p{N} ]/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
    const all = await this.s.sync.allAnnotations();
    const dup = all.find((x) => {
      if (x.annotation_type !== "study-marker" || x.deleted_at) return false;
      if (x.anchor_id !== (anchor ?? "node:flashcards")) return false;
      try {
        const d = JSON.parse(x.content);
        return norm(d.back ?? "") === norm(back);
      } catch {
        return false;
      }
    });
    if (dup) {
      new import_obsidian9.Notice("You already have this flashcard \u{1F0CF}");
      return false;
    }
    const a = {
      annotation_id: uuid(),
      author_user_id: this.s.device.userId,
      anchor_type: anchor && parseVerseId(anchor) ? "verse" : "node",
      anchor_id: anchor ?? "node:flashcards",
      annotation_type: "study-marker",
      selected_text: null,
      start_offset: null,
      end_offset: null,
      text_hash: null,
      content: JSON.stringify({
        front,
        back,
        card: { ease: 2.5, intervalDays: 0, due: nowIso(), reps: 0 }
      }),
      color: null,
      style: null,
      theme: null,
      visibility: "private",
      group_id: null,
      created_at: nowIso(),
      updated_at: nowIso(),
      deleted_at: null,
      version: 1
    };
    await this.s.sync.save(a);
    this.s.rerenderReading();
    new import_obsidian9.Notice("Flashcard added \u{1F0CF}");
    return true;
  }
  async review() {
    const all = await this.s.sync.allAnnotations();
    const due = all.filter((a) => {
      if (a.annotation_type !== "study-marker") return false;
      try {
        const c = JSON.parse(a.content).card;
        return c.due <= nowIso();
      } catch {
        return false;
      }
    });
    if (!due.length) return void new import_obsidian9.Notice("No cards due \u2014 well done!");
    new ReviewModal(this.s, due, async (a, quality) => {
      const data = JSON.parse(a.content);
      const c = data.card;
      if (quality < 2) {
        c.intervalDays = 0;
        c.due = nowIso();
      } else {
        c.ease = Math.max(1.3, c.ease + (quality === 3 ? 0.1 : -0.15));
        c.intervalDays = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.round(c.intervalDays * c.ease);
        c.reps += 1;
        c.due = new Date(Date.now() + c.intervalDays * 864e5).toISOString();
      }
      await this.s.sync.save({ ...a, content: JSON.stringify(data), updated_at: nowIso() });
    }).open();
  }
};
var NameModal = class extends import_obsidian9.Modal {
  constructor(s, initial, onSubmit) {
    super(s.app);
    this.initial = initial;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Save study trail" });
    let v = this.initial;
    new import_obsidian9.Setting(this.contentEl).setName("Name").addText((t) => t.setValue(this.initial).onChange((x) => v = x));
    new import_obsidian9.Setting(this.contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(() => {
      this.close();
      this.onSubmit(v || this.initial);
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ReviewModal = class extends import_obsidian9.Modal {
  constructor(s, cards, grade) {
    super(s.app);
    this.cards = cards;
    this.grade = grade;
  }
  i = 0;
  onOpen() {
    this.render();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.i >= this.cards.length) {
      contentEl.createEl("h3", { text: "Review complete \u{1F389}" });
      return;
    }
    const a = this.cards[this.i];
    const data = JSON.parse(a.content);
    contentEl.createEl("p", { text: `${this.i + 1} / ${this.cards.length}` });
    contentEl.createEl("h3", { text: data.front });
    const ref = verseDisplay(a.anchor_id);
    if (ref) contentEl.createEl("p", { text: ref, cls: "sg-card-ref" });
    const reveal = contentEl.createEl("button", { text: "Show answer" });
    reveal.onclick = () => {
      reveal.remove();
      contentEl.createEl("blockquote", { text: data.back });
      const row = contentEl.createDiv({ cls: "sg-card-grades" });
      for (const [label, q] of [["Again", 0], ["Hard", 2], ["Good", 3]]) {
        const b = row.createEl("button", { text: label });
        b.onclick = async () => {
          await this.grade(a, q);
          this.i++;
          this.render();
        };
      }
    };
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/main.ts
init_studyBar();

// src/settings.ts
var import_obsidian10 = require("obsidian");
init_src();
var SGSettingsTab = class extends import_obsidian10.PluginSettingTab {
  constructor(p) {
    super(p.app, p);
    this.p = p;
  }
  display() {
    const { containerEl: el } = this;
    const s = this.p.state;
    el.empty();
    el.createEl("h2", { text: "Account" });
    if (!s.signedIn) {
      new import_obsidian10.Setting(el).setName("Join Scripture Graph").setDesc("Sign in with your family invite code").addButton((b) => b.setButtonText("Join\u2026").setCta().onClick(() => new WelcomeModal(s, this.p.ai, () => this.display()).open()));
    } else {
      new import_obsidian10.Setting(el).setName(`Signed in as ${s.device.displayName ?? "?"}`).setDesc(`Groups: ${s.groups.map((g) => g.name).join(", ") || "none yet"}`).addButton((b) => b.setButtonText("Sign out this device").onClick(async () => {
        try {
          await s.api.logoutDevice();
        } catch {
        }
        s.device.deviceToken = null;
        s.device.userId = null;
        await s.saveDevice();
        this.display();
      }));
      new import_obsidian10.Setting(el).setName("Link another device").setDesc("Creates a one-time code (valid 1 hour) to sign THIS account in on your phone").addButton((b) => b.setButtonText("Create code").onClick(async () => {
        try {
          const inv = await s.api.createAccountInviteDeviceLink();
          new CodeModal(
            this.p,
            "Device link code",
            inv.code,
            "On the other device: Settings \u2192 Scripture Graph \u2192 Join \u2192 paste this code."
          ).open();
        } catch (e) {
          new import_obsidian10.Notice(e.message);
        }
      }));
      new import_obsidian10.Setting(el).setName("Create a group").addText((t) => t.setPlaceholder("e.g. Richins Family").then((t2) => {
        new import_obsidian10.Setting(el).addButton((b) => b.setButtonText("Create").onClick(async () => {
          const name = t2.getValue().trim();
          if (!name) return;
          await s.api.createGroup(name);
          await refreshIdentity(s);
          new import_obsidian10.Notice(`Group \u201C${name}\u201D created`);
          this.display();
        }));
      }));
      for (const g of s.groups) {
        new import_obsidian10.Setting(el).setName(`\u{1F465} ${g.name}`).setDesc(g.role).addButton((b) => b.setButtonText("Invite\u2026").onClick(async () => {
          try {
            const inv = await s.api.createGroupInvite(g.group_id);
            new CodeModal(
              this.p,
              `Invite to ${g.name}`,
              inv.code,
              "Share this code \u2014 it works for existing members via \u201CJoin group\u201D, and the owner can bundle it into account invites."
            ).open();
          } catch (e) {
            new import_obsidian10.Notice(e.message);
          }
        })).addButton((b) => b.setButtonText("Leave").setWarning().onClick(async () => {
          await s.api.leaveGroup(g.group_id);
          await refreshIdentity(s);
          this.display();
        }));
      }
      new import_obsidian10.Setting(el).setName("Join a group").setDesc("Paste a group invite code").addText((t) => t.setPlaceholder("XXXX-XXXX-XXXX").then((t2) => {
        new import_obsidian10.Setting(el).addButton((b) => b.setButtonText("Join group").onClick(async () => {
          try {
            const r = await s.api.acceptInvite(t2.getValue().trim());
            await refreshIdentity(s);
            new import_obsidian10.Notice(`Joined ${r.group_name ?? "group"}`);
            this.display();
          } catch (e) {
            new import_obsidian10.Notice(e.message);
          }
        }));
      }));
    }
    el.createEl("h2", { text: "Reading" });
    new import_obsidian10.Setting(el).setName("Chapter links open My Study page").setDesc("Links like [[Matthew 5]] land on your editable page (the scripture is embedded there). Verse-precise links still open the exact verse.").addToggle((t) => t.setValue(s.settings.chapterLinksToMyStudy).onChange(async (v) => {
      s.applySettings({ chapterLinksToMyStudy: v });
      await this.p.saveSharedSettings();
    }));
    el.createEl("h2", { text: "Sharing & privacy" });
    new import_obsidian10.Setting(el).setName("Default for new notes/highlights").setDesc("\u{1F510} Only me (synced) is recommended; \u{1F512} device-only never uploads anywhere").addDropdown((d) => d.addOption("private", "\u{1F510} Only me (synced)").addOption("local", "\u{1F512} Only me (this device)").setValue(s.settings.defaultVisibility).onChange(async (v) => {
      s.settings.defaultVisibility = v;
      await this.p.saveSharedSettings();
    }));
    new import_obsidian10.Setting(el).setName("Show my marks").addToggle((t) => t.setValue(s.device.showScopes.mine).onChange(async (v) => {
      s.device.showScopes.mine = v;
      await s.saveDevice();
      s.notify();
    }));
    for (const g of s.groups) {
      new import_obsidian10.Setting(el).setName(`Show ${g.name}`).addToggle((t) => t.setValue(s.device.showScopes.groups[g.group_id] !== false).onChange(async (v) => {
        s.device.showScopes.groups[g.group_id] = v;
        await s.saveDevice();
        s.notify();
      }));
    }
    new import_obsidian10.Setting(el).setName("Show public highlights").addToggle((t) => t.setValue(s.device.showScopes.public).onChange(async (v) => {
      s.device.showScopes.public = v;
      await s.saveDevice();
      s.notify();
    }));
    el.createEl("h2", { text: "AI (your own wallet \u2014 never a shared key)" });
    if (!s.aiConnected) {
      new import_obsidian10.Setting(el).setName("Connect AI").setDesc(
        "Authorizes Scripture Graph to use YOUR OpenRouter balance. ~$10 lasts a long time."
      ).addButton((b) => b.setButtonText("Connect AI").setCta().onClick(async () => {
        await this.p.ai.beginConnect();
        new import_obsidian10.Notice("Finish in the browser \u2014 Obsidian catches the redirect. If it doesn't return, paste the code below.");
        this.display();
      }));
      new import_obsidian10.Setting(el).setName("Paste authorization code").setDesc("Only needed if the browser redirect didn't come back").addText((t) => t.setPlaceholder("code from openrouter.ai").then((t2) => {
        new import_obsidian10.Setting(el).addButton((b) => b.setButtonText("Finish connection").onClick(async () => {
          try {
            await this.p.ai.completeConnect(t2.getValue());
            this.display();
          } catch (e) {
            new import_obsidian10.Notice(e.message);
          }
        }));
      }));
    } else {
      new import_obsidian10.Setting(el).setName("AI connected \u2713").addButton((b) => b.setButtonText("Disconnect").setWarning().onClick(async () => {
        await this.p.ai.disconnect();
        this.display();
      }));
      new import_obsidian10.Setting(el).setName("Preferred models").addDropdown((d) => d.addOption("auto", "AUTO \u2014 recommended").addOption("fast", "Fast & cheap").addOption("deep", "Deep research").addOption("best", "Highest quality").addOption("cheapest", "Cheapest").addOption("specific", "Specific model\u2026").setValue(s.device.aiTier).onChange(async (v) => {
        s.device.aiTier = v;
        await s.saveDevice();
        this.display();
      }));
      if (s.device.aiTier === "specific") {
        new import_obsidian10.Setting(el).setName("Model id").setDesc("Advanced: any OpenRouter model id").addText((t) => t.setValue(s.device.aiSpecificModel ?? "").setPlaceholder(TIER_CANDIDATES.deep[0] ?? "").onChange(async (v) => {
          s.device.aiSpecificModel = v.trim() || null;
          await s.saveDevice();
        }));
      }
      new import_obsidian10.Setting(el).setName("Monthly safety cap (USD)").setDesc("Scripture Graph stops starting AI requests past this amount").addText((t) => {
        void this.p.state.budget.state().then((b) => t.setValue(String(b.capUsd)));
        t.onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) await this.p.state.budget.setCap(n);
        });
      });
      void this.p.state.budget.state().then(async (b) => {
        const wallet = await this.p.ai.wallet();
        new import_obsidian10.Setting(el).setName(
          `This month: $${b.spentUsd.toFixed(2)} / $${b.capUsd.toFixed(2)}`
        ).setDesc(wallet ? `OpenRouter wallet: $${wallet.usageUsd.toFixed(2)} used${wallet.limitUsd ? ` of $${wallet.limitUsd}` : ""}` : "");
      });
      new import_obsidian10.Setting(el).setName("Let AI read my private notes as context").setDesc("Off by default. AI never modifies your notes either way (\xA727).").addToggle((t) => t.setValue(s.device.aiUsePersonalNotes).onChange(async (v) => {
        s.device.aiUsePersonalNotes = v;
        await s.saveDevice();
      }));
    }
    el.createEl("h2", { text: "My data" });
    new import_obsidian10.Setting(el).setName("Export my data").setDesc("All annotations + highlights \u2192 Markdown/JSON in Library/Exports").addButton((b) => b.setButtonText("Export").onClick(() => void this.p.exportMyData()));
    new import_obsidian10.Setting(el).setName(`Plugin version: v${this.p.manifest.version}`).setDesc("Updates come straight from your family server \u2014 no sync games").addButton((b) => b.setButtonText("Check for updates").onClick(() => void this.p.checkForUpdate(false)));
    new import_obsidian10.Setting(el).setName("Debug: copy interaction log").setDesc("Copies what the touch layer saw (taps, selections, decisions) \u2014 paste it to whoever is fixing a bug").addButton((b) => b.setButtonText("Copy log").onClick(async () => {
      const { traceDump: traceDump2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
      await navigator.clipboard.writeText(
        `Scripture Graph v${this.p.manifest.version}
` + traceDump2()
      );
      new import_obsidian10.Notice("Interaction log copied \u2014 paste it in a message");
    })).addToggle((t) => t.setValue(s.device.debugOverlay ?? false).onChange(async (v) => {
      s.device.debugOverlay = v;
      await s.saveDevice();
      const { setOverlay: setOverlay2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
      setOverlay2(v);
    }));
    new import_obsidian10.Setting(el).setName("Server address").setDesc(
      "Shared with the whole vault (everyone needs the same backend)"
    ).addText((t) => t.setValue(s.settings.serverUrl).onChange(async (v) => {
      s.applySettings({ serverUrl: v.trim() });
      await this.p.saveSharedSettings();
    }));
    if (s.signedIn && s.groups.some(() => true)) {
    }
    void this.renderAdmin(el);
  }
  async renderAdmin(el) {
    const s = this.p.state;
    if (!s.signedIn) return;
    try {
      const me = await s.api.me();
      if (me.user.role !== "owner") return;
      el.createEl("h2", { text: "Owner admin" });
      new import_obsidian10.Setting(el).setName("New family account invite").addButton((b) => b.setButtonText("Create invite").onClick(async () => {
        const inv = await s.api.createAccountInvite(1, 24 * 30);
        new CodeModal(
          this.p,
          "Family account invite",
          inv.code,
          "Single use, 30 days. They enter it in Join Scripture Graph."
        ).open();
      }));
      const over = await s.api.adminOverview().catch(() => null);
      if (over) {
        el.createEl("p", {
          text: `Backend: ${over["users"]} users \xB7 ${over["devices"]} devices \xB7 ${over["groups"]} groups \xB7 ${over["annotations"]} annotations`
        });
      }
    } catch {
    }
  }
};
var CodeModal = class extends import_obsidian10.Modal {
  constructor(p, title, code, hint) {
    super(p.app);
    this.title = title;
    this.code = code;
    this.hint = hint;
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: this.title });
    const codeEl = this.contentEl.createEl("code", { text: this.code, cls: "sg-invite-code" });
    this.contentEl.createEl("p", { text: this.hint });
    new import_obsidian10.Setting(this.contentEl).addButton((b) => b.setButtonText("Copy").setCta().onClick(async () => {
      await navigator.clipboard.writeText(this.code);
      new import_obsidian10.Notice("Copied");
    }));
    codeEl.onclick = () => void navigator.clipboard.writeText(this.code);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/migrate.ts
var import_obsidian11 = require("obsidian");
init_src();
var OLD_DATA = ".obsidian/plugins/scripture-graph-annotate/data.json";
var FLAG = "migrated_v02_annotate";
async function migrateFromAnnotate(s) {
  if (await s.store.get(FLAG)) return;
  const adapter = s.app.vault.adapter;
  let raw;
  try {
    if (!await adapter.exists(OLD_DATA)) {
      await s.store.put(FLAG, true);
      return;
    }
    raw = await adapter.read(OLD_DATA);
  } catch {
    return;
  }
  let old;
  try {
    old = JSON.parse(raw);
  } catch {
    await s.store.put(FLAG, true);
    return;
  }
  let count = 0;
  for (const [verseId, list] of Object.entries(old.highlights ?? {})) {
    for (const h of list ?? []) {
      const a = {
        annotation_id: uuid(),
        author_user_id: s.device.userId,
        anchor_type: "verse",
        anchor_id: verseId,
        annotation_type: "highlight",
        selected_text: null,
        start_offset: null,
        end_offset: null,
        text_hash: null,
        content: "",
        color: h.color ?? "yellow",
        style: null,
        theme: null,
        visibility: "local",
        group_id: null,
        created_at: h.created ?? nowIso(),
        updated_at: h.created ?? nowIso(),
        deleted_at: null,
        version: 1
      };
      if (h.text) a.selected_text = h.text;
      await s.sync.save(a);
      count++;
    }
  }
  await s.store.put(FLAG, true);
  if (count) {
    new import_obsidian11.Notice(`Scripture Graph: imported ${count} highlight${count === 1 ? "" : "s"} from the old plugin (kept device-local \u2014 share any of them from the verse popover).`);
  }
}

// src/main.ts
function newerVersion(remote, local) {
  const r = remote.split(".").map(Number);
  const l = local.split(".").map(Number);
  if (r.some(Number.isNaN) || l.some(Number.isNaN) || !remote) return false;
  for (let i = 0; i < 3; i++) {
    const a = r[i] ?? 0, b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}
var SGPlugin = class extends import_obsidian12.Plugin {
  state;
  ai;
  ann;
  study;
  studyBar;
  origOpenLinkText = null;
  studyActionViews = /* @__PURE__ */ new WeakSet();
  async onload() {
    this.state = new SGState(this.app, this);
    const saved = await this.loadData();
    if (saved) this.state.applySettings(saved);
    await this.state.loadDevice();
    this.ai = new AiService(this.state);
    this.ann = new AnnotationService(this.state);
    this.study = new StudyService(this.state, this.ann);
    this.addSettingTab(new SGSettingsTab(this));
    this.registerView(ASK_VIEW, (leaf) => new AskView(leaf, this.state, this.ai, this.ann));
    this.registerView(READER_VIEW, (leaf) => new ReaderView(leaf, this.state, this.ann, (c, v, seed) => void this.openAsk(c, v, seed)));
    this.registerObsidianProtocolHandler("scripture-graph-auth", (params) => {
      const code = params["code"];
      if (!code) return void new import_obsidian12.Notice("AI connection failed: no code in redirect");
      this.ai.completeConnect(code).catch((e) => new import_obsidian12.Notice(e.message));
    });
    const openAskFromReading = (prompt, anchor) => {
      const ct = this.chapterTitleFor(anchor);
      void this.openAsk(ct, anchor, prompt);
    };
    this.studyBar = new StudyBar(
      this.state,
      this.ann,
      this.study,
      openAskFromReading,
      () => this.saveSharedSettings()
    );
    registerReadingIntegration(this, this.state, this.ann, this.studyBar, openAskFromReading);
    this.addCommand({
      id: "open-ask",
      name: "Ask AI about this passage",
      icon: "sparkles",
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        const isChapter = f?.path.startsWith(CANONICAL_PREFIX) ?? false;
        void this.openAsk(isChapter ? f.basename : null, null);
      }
    });
    this.addCommand({
      id: "open-reader",
      name: "Open in Scripture Graph reader",
      icon: "book-open",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const ok = !!f && f.path.startsWith(CANONICAL_PREFIX);
        if (!checking && ok) void this.openReader(f.basename);
        return ok;
      }
    });
    this.addCommand({
      id: "highlight-selection",
      name: "Highlight selection (quick)",
      icon: "highlighter",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        if (!hit) return void new import_obsidian12.Notice("Select some scripture text first");
        const vis = this.state.settings.defaultVisibility === "local" ? "local" : "private";
        void this.ann.addHighlight(hit.verseId, "yellow", hit.verseText, hit.selected, vis, null);
        new import_obsidian12.Notice(`Highlighted ${verseDisplay(hit.verseId) ?? hit.verseId}`);
      }
    });
    this.addCommand({
      id: "note-selection",
      name: "Add note on selection",
      icon: "pencil",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        if (!hit) return void new import_obsidian12.Notice("Select some scripture text first");
        new NoteModal(this.state, verseDisplay(hit.verseId) ?? hit.verseId, (text) => {
          const vis = this.state.settings.defaultVisibility === "local" ? "local" : "private";
          void this.ann.addNote(hit.verseId, text, hit.selected, vis, null);
          new import_obsidian12.Notice("Note saved");
        }).open();
      }
    });
    this.addCommand({
      id: "open-my-study",
      name: "Open my study page for this chapter",
      icon: "pencil",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        const ok = !!f && f.path.startsWith(CANONICAL_PREFIX) && !!chapterIdFromTitle(f.basename);
        if (!checking && ok) this.openMyStudy(f.basename);
        return ok;
      }
    });
    this.addCommand({
      id: "open-graph",
      name: "See connections graph for this page",
      icon: "git-fork",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        if (!f) return false;
        if (!checking) {
          const title = f.basename.endsWith(" - My Notes") ? f.basename.slice(0, -" - My Notes".length) : f.basename;
          void openLocalGraphFor(this.state, title);
        }
        return true;
      }
    });
    this.addCommand({
      id: "bookmark",
      name: "Bookmark this page",
      icon: "bookmark",
      callback: () => void this.study.bookmarkCurrent()
    });
    this.addCommand({
      id: "save-trail",
      name: "Save study trail",
      icon: "footprints",
      callback: () => void this.study.saveTrail()
    });
    this.addCommand({
      id: "review-flashcards",
      name: "Review flashcards",
      icon: "layers",
      callback: () => void this.study.review()
    });
    this.addCommand({
      id: "flashcard-from-selection",
      name: "Make flashcard from selection",
      icon: "plus-square",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        const sel = hit?.selected ?? window.getSelection()?.toString().trim() ?? "";
        if (!sel) return void new import_obsidian12.Notice("Select the text for the card back first");
        const ref = hit ? verseDisplay(hit.verseId) : null;
        void this.study.addFlashcard(
          ref ? `What does ${ref} say?` : "Recall this passage",
          sel,
          hit?.verseId ?? null
        );
      }
    });
    this.addCommand({
      id: "sync-now",
      name: "Sync now",
      icon: "refresh-cw",
      callback: async () => {
        await this.ann.syncNow();
        new import_obsidian12.Notice("Synced");
      }
    });
    this.addCommand({
      id: "cleanup-marks",
      name: "Clean up marks (duplicates & conflict copies)",
      icon: "eraser",
      callback: () => void this.cleanupMarks()
    });
    this.addCommand({
      id: "export-my-data",
      name: "Export my data",
      icon: "download",
      callback: () => void this.exportMyData()
    });
    this.addCommand({
      id: "join",
      name: "Join Scripture Graph (invite code)",
      icon: "user-plus",
      callback: () => new WelcomeModal(this.state, this.ai, () => {
      }).open()
    });
    this.registerEvent(this.app.workspace.on("file-open", (f) => {
      if (!f) return;
      this.studyBar.clear();
      this.study.recordVisit(f);
      this.enforceReadOnly();
      this.openInPreviewOnce(f);
      this.addMyStudyAction(f);
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.enforceReadOnly()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.enforceReadOnly()));
    this.origOpenLinkText = this.app.workspace.openLinkText.bind(this.app.workspace);
    const orig = this.origOpenLinkText;
    this.app.workspace.openLinkText = (linktext, sourcePath, newLeaf, openViewState) => {
      const redirect = this.companionForLink(linktext, sourcePath);
      return orig(
        redirect ?? linktext,
        sourcePath,
        newLeaf,
        openViewState
      );
    };
    this.app.workspace.onLayoutReady(() => {
      void (async () => {
        const plugins = this.app.plugins;
        if (plugins?.enabledPlugins?.has?.("scripture-graph-annotate")) {
          await plugins.disablePluginAndSave?.("scripture-graph-annotate");
          new import_obsidian12.Notice("Old Scripture Graph plugin retired (it kept re-enabling itself via sync)");
        }
        const seen = await this.state.store.get("last_loaded_version");
        if (seen !== this.manifest.version) {
          await this.state.store.put("last_loaded_version", this.manifest.version);
          new import_obsidian12.Notice(`Scripture Graph v${this.manifest.version} loaded`);
        }
        if (this.state.device.debugOverlay) {
          const { setOverlay: setOverlay2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
          setOverlay2(true);
        }
        await migrateFromAnnotate(this.state);
        this.ann.start();
        await refreshIdentity(this.state);
        if (!this.state.signedIn && !await this.state.store.get("welcome_shown")) {
          await this.state.store.put("welcome_shown", true);
          new WelcomeModal(this.state, this.ai, () => {
          }).open();
        }
        const last = await this.state.store.get("update_checked_at") ?? 0;
        if (Date.now() - last > 6 * 36e5) {
          await this.state.store.put("update_checked_at", Date.now());
          void this.checkForUpdate(true);
        }
      })();
    });
  }
  // ------------------------------------------------------------ self-update
  /** Pull the latest build from the family server's /plugin channel and
   * install it in place. `silent` = only speak when something happens. */
  async checkForUpdate(silent) {
    const base = this.state.settings.serverUrl.replace(/\/$/, "");
    try {
      const mf = await (0, import_obsidian12.requestUrl)({ url: `${base}/plugin/manifest.json`, throw: false });
      if (mf.status !== 200) {
        if (!silent) new import_obsidian12.Notice("No plugin build published on the server yet");
        return;
      }
      let manifest;
      try {
        manifest = JSON.parse(mf.text.replace(/^\uFEFF/, ""));
      } catch {
        if (!silent) new import_obsidian12.Notice("Update channel returned an unreadable manifest");
        return;
      }
      const remote = manifest.version ?? "";
      if (!newerVersion(remote, this.manifest.version)) {
        if (!silent) new import_obsidian12.Notice(`Up to date \u2014 v${this.manifest.version}`);
        return;
      }
      const [main, styles] = await Promise.all([
        (0, import_obsidian12.requestUrl)({ url: `${base}/plugin/main.js`, throw: false }),
        (0, import_obsidian12.requestUrl)({ url: `${base}/plugin/styles.css`, throw: false })
      ]);
      if (main.status !== 200 || main.text.length < 1e4) {
        if (!silent) new import_obsidian12.Notice("Update download failed \u2014 try again");
        return;
      }
      const dir = `${this.app.vault.configDir}/plugins/scripture-graph`;
      const ad = this.app.vault.adapter;
      await ad.write(`${dir}/main.js`, main.text);
      if (styles.status === 200) await ad.write(`${dir}/styles.css`, styles.text);
      await ad.write(`${dir}/manifest.json`, JSON.stringify(mf.json, null, 2));
      new import_obsidian12.Notice(`Scripture Graph updated to v${remote} \u2014 reloading\u2026`, 8e3);
      window.setTimeout(() => {
        const cmds = this.app.commands;
        cmds?.executeCommandById?.("app:reload");
      }, 900);
    } catch (e) {
      if (!silent) new import_obsidian12.Notice(`Update check failed: ${e.message}`);
    }
  }
  onunload() {
    this.ann.stop();
    this.studyBar?.clear();
    if (this.origOpenLinkText) {
      this.app.workspace.openLinkText = this.origOpenLinkText;
    }
  }
  /** "<Chapter> - My Notes" when the link should land on the editable page. */
  companionForLink(linktext, sourcePath) {
    if (!this.state.settings.chapterLinksToMyStudy) return null;
    if (!linktext || linktext.includes("#")) return null;
    const dest = this.app.metadataCache.getFirstLinkpathDest(linktext, sourcePath);
    if (!dest || !dest.path.startsWith(CANONICAL_PREFIX)) return null;
    if (!chapterIdFromTitle(dest.basename)) return null;
    const srcBase = sourcePath.split("/").pop() ?? "";
    if (srcBase === `${dest.basename} - My Notes.md`) return null;
    const companion = `${dest.basename} - My Notes`;
    return this.app.metadataCache.getFirstLinkpathDest(companion, "") ? companion : null;
  }
  openMyStudy(chapterTitle2) {
    const companion = `${chapterTitle2} - My Notes`;
    if (this.app.metadataCache.getFirstLinkpathDest(companion, "")) {
      void (this.origOpenLinkText ?? this.app.workspace.openLinkText)(companion, "");
    } else {
      new import_obsidian12.Notice("No My Notes page exists for this chapter yet");
    }
  }
  /** ✏️ + 🕸 buttons in the title bar of every canonical chapter view. */
  addMyStudyAction(f) {
    if (!f.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(f.basename)) return;
    const view = this.app.workspace.getActiveViewOfType(import_obsidian12.MarkdownView);
    if (!view || view.file?.path !== f.path || this.studyActionViews.has(view)) return;
    this.studyActionViews.add(view);
    view.addAction("git-fork", "See this chapter's connections graph", () => {
      const cur = view.file;
      if (cur) void openLocalGraphFor(this.state, cur.basename);
    });
    view.addAction("pencil", "Open my study page (editable)", () => {
      const cur = view.file;
      if (cur) this.openMyStudy(cur.basename);
    });
  }
  // ------------------------------------------------------------------ util
  async saveSharedSettings() {
    await this.saveData(this.state.settings);
  }
  chapterTitleFor(verseId) {
    if (!verseId) return null;
    const r = parseVerseId(verseId);
    return r ? chapterTitle(r.bookSlug, r.chapter) : null;
  }
  /** Personal Library pages open reading-first; the pencil toggle switches to
   * writing and sticks until the next open. Mobile restores a tab's editing
   * mode slightly AFTER file-open fires, so the flip retries briefly. */
  openInPreviewOnce(f) {
    if (!f.path.startsWith(PERSONAL_PREFIX)) return;
    const flip = () => {
      const view = this.app.workspace.getActiveViewOfType(import_obsidian12.MarkdownView);
      if (!view || view.file?.path !== f.path) return;
      if (view.getMode() === "preview") return;
      void view.leaf.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" }
      });
    };
    flip();
    window.setTimeout(flip, 150);
    window.setTimeout(flip, 500);
  }
  /** Scripture is a study surface, not an editor. Canonical files are ALWAYS
   * flipped back to reading view (even if the user hits the pencil toggle —
   * phones have no OS read-only bit); the rest of the AI Library follows the
   * forceLibraryPreview setting. Personal Library/ files are never touched. */
  noticedReadOnly = /* @__PURE__ */ new Set();
  enforceReadOnly() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian12.MarkdownView) || !view.file) continue;
      const path = view.file.path;
      const canonical = path.startsWith(CANONICAL_PREFIX);
      const aiLibrary = path.startsWith(LIBRARY_PREFIX);
      if (!canonical && !(aiLibrary && this.state.settings.forceLibraryPreview)) continue;
      if (view.getMode() === "preview") continue;
      void leaf.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" }
      });
      if (canonical && !this.noticedReadOnly.has(path)) {
        this.noticedReadOnly.add(path);
        new import_obsidian12.Notice("Scripture is read-only \u2014 highlight it, or write in \u270F\uFE0F My Notes");
      }
    }
  }
  async openAsk(chapterTitle2, verseId, seed) {
    const leaf = await this.ensureLeaf(ASK_VIEW, "right");
    if (!leaf) return;
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof AskView) view.setAnchor(chapterTitle2, verseId, seed);
  }
  async openReader(title) {
    const leaf = await this.ensureLeaf(READER_VIEW, "tab");
    if (!leaf) return;
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof ReaderView) await view.setChapter(title);
  }
  async ensureLeaf(type, where) {
    const existing = this.app.workspace.getLeavesOfType(type)[0];
    if (existing) return existing;
    const leaf = where === "right" ? this.app.workspace.getRightLeaf(false) : this.app.workspace.getLeaf("tab");
    if (leaf) await leaf.setViewState({ type, active: true });
    return leaf;
  }
  /** §49 data portability: everything of mine → Library/Exports (Markdown + JSON). */
  async exportMyData() {
    const folder = `${PERSONAL_PREFIX}Exports`;
    if (!this.app.vault.getAbstractFileByPath(folder)) {
      await this.app.vault.createFolder(folder);
    }
    const stamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const local = await this.state.sync.allAnnotations();
    let server = null;
    if (this.state.signedIn) {
      try {
        server = await this.state.api.exportMyData();
      } catch {
      }
    }
    const json = JSON.stringify({
      exported_at: (/* @__PURE__ */ new Date()).toISOString(),
      device_annotations: local,
      server_export: server
    }, null, 2);
    await this.writeExport(`${folder}/scripture-graph-export-${stamp}.json`, json);
    const lines = [
      "---",
      "ownership: personal",
      "mutable: user",
      "content_type: export",
      "---",
      "",
      `# My Scripture Graph data \u2014 ${stamp}`,
      ""
    ];
    const byAnchor = /* @__PURE__ */ new Map();
    for (const a of local.filter((x) => !x.deleted_at)) {
      const arr = byAnchor.get(a.anchor_id) ?? [];
      arr.push(a);
      byAnchor.set(a.anchor_id, arr);
    }
    for (const [anchor, list] of [...byAnchor.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
      lines.push(`## ${verseDisplay(anchor) ?? anchor}`, "");
      for (const a of list) {
        const vis = a.visibility === "local" ? "device-only" : a.visibility;
        if (a.annotation_type === "highlight") {
          lines.push(`- \u{1F58D} ${a.color ?? "yellow"} highlight (${vis})${a.selected_text ? `: "${a.selected_text}"` : ""}`);
        } else if (a.content) {
          lines.push(`- \u{1F4DD} (${vis}) ${a.content.replace(/\n/g, " ")}`);
        }
      }
      lines.push("");
    }
    await this.writeExport(`${folder}/My annotations ${stamp}.md`, lines.join("\n"));
    new import_obsidian12.Notice("Exported to Library/Exports");
  }
  /** One sweep over my annotations: duplicate flashcards, duplicate
   * highlights, and "⚠ Conflict copy" junk notes get soft-deleted (oldest
   * copy of each real thing is kept). */
  async cleanupMarks() {
    const norm = (t) => t.replace(/\s+/g, " ").trim().toLowerCase();
    const all = (await this.state.sync.allAnnotations()).filter((a) => a.author_user_id === this.state.device.userId || a.author_user_id === null).sort((a, b) => a.created_at.localeCompare(b.created_at));
    const seen = /* @__PURE__ */ new Set();
    let removed = 0;
    for (const a of all) {
      if (a.annotation_type === "note" && a.content.startsWith("\u26A0 Conflict copy")) {
        await this.state.sync.softDelete(a.annotation_id);
        removed++;
        continue;
      }
      let key = null;
      if (a.annotation_type === "study-marker") {
        try {
          const d = JSON.parse(a.content);
          key = `card|${a.anchor_id}|${norm(d.back ?? "")}`;
        } catch {
          key = null;
        }
      } else if (a.annotation_type === "highlight") {
        key = `hl|${a.anchor_id}|${a.color ?? ""}|${norm(a.selected_text ?? "")}`;
      } else if (a.annotation_type === "bookmark") {
        key = `bm|${a.anchor_id}`;
      }
      if (!key) continue;
      if (seen.has(key)) {
        await this.state.sync.softDelete(a.annotation_id);
        removed++;
      } else {
        seen.add(key);
      }
    }
    this.ann.scheduleSync(500);
    this.state.rerenderReading();
    new import_obsidian12.Notice(removed ? `Cleaned up ${removed} duplicate/junk mark${removed === 1 ? "" : "s"} \u{1F9F9}` : "Nothing to clean \u2014 your marks are tidy \u2728");
  }
  async writeExport(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian12.TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }
};
