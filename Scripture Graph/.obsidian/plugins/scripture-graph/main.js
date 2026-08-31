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
      /** what my groups have been studying lately, rolled up per chapter */
      groupActivity() {
        return this.req("GET", "/activity/groups");
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

// src/study/sheetRegistry.ts
function registerSheet(m) {
  open.add(m);
}
function unregisterSheet(m) {
  open.delete(m);
}
function closeAllSheets() {
  for (const m of Array.from(open)) {
    open.delete(m);
    try {
      m.close();
    } catch {
    }
  }
}
var open;
var init_sheetRegistry = __esm({
  "src/study/sheetRegistry.ts"() {
    "use strict";
    open = /* @__PURE__ */ new Set();
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

// src/study/timelineView.ts
var timelineView_exports = {};
__export(timelineView_exports, {
  SubjectPickerModal: () => SubjectPickerModal,
  TIMELINE_VIEW: () => TIMELINE_VIEW,
  TimelineView: () => TimelineView,
  loadTimelineData: () => loadTimelineData
});
function yearStr(y) {
  return y < 0 ? `${-y} BC` : `AD ${y}`;
}
async function loadTimelineData(app) {
  const file = app.vault.getAbstractFileByPath(DATA_PATH);
  if (!(file instanceof import_obsidian6.TFile)) return null;
  try {
    const md = await app.vault.cachedRead(file);
    const m = /```json\n([\s\S]*?)\n```/.exec(md);
    if (!m) return null;
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
var import_obsidian6, TIMELINE_VIEW, SUBJECT_META, DATA_PATH, ERAS, ERA_TINT, CATS, DATING_SHORT, NARRATIVE_LINKS, LANE_COLOR, LANE_NAME, LANE_F, LANE_DIR, THREAD_F, TimelineView, SubjectPickerModal;
var init_timelineView = __esm({
  "src/study/timelineView.ts"() {
    "use strict";
    import_obsidian6 = require("obsidian");
    init_sheetRegistry();
    TIMELINE_VIEW = "sg-timeline";
    SUBJECT_META = {
      people: { emoji: "\u{1F9D1}", label: "People" },
      places: { emoji: "\u{1F5FA}", label: "Places" },
      things: { emoji: "\u{1F4E6}", label: "Things" }
    };
    DATA_PATH = "AI Library/90 Timeline/_data.md";
    ERAS = [
      { label: "Beginnings", y: -4e3 },
      { label: "Abraham", y: -2e3 },
      { label: "Exodus", y: -1446 },
      { label: "Kings", y: -1050 },
      { label: "Lehi & Exile", y: -605 },
      { label: "Judges", y: -130 },
      { label: "Christ", y: -6 },
      { label: "Apostles", y: 34 },
      { label: "Cumorah", y: 320 },
      { label: "Restoration", y: 1820 }
    ];
    ERA_TINT = {
      "Beginnings": "rgba(146, 124, 255, 0.05)",
      "Abraham": "rgba(255, 196, 130, 0.04)",
      "Exodus": "rgba(255, 148, 96, 0.045)",
      "Kings": "rgba(255, 214, 126, 0.045)",
      "Lehi & Exile": "rgba(118, 196, 255, 0.05)",
      "Judges": "rgba(110, 232, 172, 0.045)",
      "Christ": "rgba(255, 240, 200, 0.06)",
      "Apostles": "rgba(255, 204, 156, 0.04)",
      "Cumorah": "rgba(224, 142, 128, 0.05)",
      "Restoration": "rgba(122, 182, 255, 0.055)"
    };
    CATS = [
      { key: "prophets", label: "\u{1F54A} Prophets" },
      { key: "visions", label: "\u2728 Visions" },
      { key: "wars", label: "\u2694\uFE0F Wars" },
      { key: "rulers", label: "\u{1F451} Rulers" },
      { key: "journeys", label: "\u{1F9ED} Journeys" },
      { key: "temples", label: "\u{1F3DB} Temples" },
      { key: "records", label: "\u{1F4DC} Records" },
      { key: "turning", label: "\u{1F511} Turning points" }
    ];
    DATING_SHORT = {
      traditional: "trad.",
      approximate: "approx.",
      internal: "BoM internal",
      historical: "historical"
    };
    NARRATIVE_LINKS = [
      ["babel", "jaredite-voyage"],
      ["jerusalem-falls", "lehi-departs"],
      ["jaredite-end", "coriantumr-zarahemla"],
      ["isaiah", "brass-plates"],
      ["resurrection", "christ-bountiful"],
      ["samuel-lamanite", "christ-birth"],
      ["cumorah", "moroni-visits"],
      ["moroni-alone", "bom-published"],
      ["malachi", "kirtland-temple"]
    ];
    LANE_COLOR = {
      ow: "#d9a441",
      nw: "#4cc38a",
      rs: "#52a9ff"
    };
    LANE_NAME = {
      ow: "\u{1F30D} Bible",
      nw: "\u{1F30E} Book of Mormon",
      rs: "\u{1F305} Restoration"
    };
    LANE_F = { ow: 0.13, nw: 0.87, rs: 0.5 };
    LANE_DIR = { ow: 1, nw: -1, rs: 1 };
    THREAD_F = {
      ow: [0.27, 0.35],
      nw: [0.7, 0.62, 0.75, 0.55],
      rs: [0.4, 0.6]
    };
    TimelineView = class extends import_obsidian6.ItemView {
      constructor(leaf, s) {
        super(leaf);
        this.s = s;
        const dev = s.device;
        if (dev?.tlDepth === 1 || dev?.tlDepth === 2) this.depth = dev.tlDepth;
      }
      data = null;
      lanes = /* @__PURE__ */ new Set(["ow", "nw", "rs"]);
      cats = new Set(CATS.map((c) => c.key));
      detail = false;
      // false = major+notable only
      depth = 2;
      // 2 = storylines braid out of their lane
      query = "";
      focus = null;
      pendingYear = null;
      streamEl = null;
      showLenses = false;
      // category row folded away by default
      showSearch = false;
      // search folded away by default
      lastW = 0;
      retriedZeroWidth = false;
      /** Obsidian calls this on pane resize; the window listener covers rotation */
      onResize() {
        const w = this.streamEl?.clientWidth ?? 0;
        if (w > 80 && Math.abs(w - this.lastW) > 24) this.renderStream();
      }
      boundResize = () => this.onResize();
      /** enter/leave focus mode: the constellation becomes ONE subject's thread */
      setFocus(subject) {
        this.focus = subject;
        this.render();
      }
      /** back to seeing everything — one tap out of any filter corner */
      resetFilters() {
        this.lanes = /* @__PURE__ */ new Set(["ow", "nw", "rs"]);
        this.cats = new Set(CATS.map((c) => c.key));
        this.detail = false;
        this.query = "";
        this.showLenses = false;
        this.showSearch = false;
        this.render();
      }
      saveDepth() {
        const s = this.s;
        if (s.device) {
          s.device.tlDepth = this.depth;
          void s.saveDevice?.();
        }
      }
      getViewType() {
        return TIMELINE_VIEW;
      }
      getDisplayText() {
        return "Timeline";
      }
      getIcon() {
        return "history";
      }
      /** scroll to a year once rendered (era-tap from a reading page) */
      setYear(y) {
        this.pendingYear = y;
        if (this.data) this.scrollToYear(y);
      }
      async onOpen() {
        this.contentEl.addClass("sg-tl");
        this.data = await loadTimelineData(this.s.app);
        this.render();
        window.addEventListener("resize", this.boundResize);
        const vault = this.s.app.vault;
        if (typeof vault.on === "function") {
          const arrived = (f) => {
            if (this.data || f?.path !== DATA_PATH) return;
            void this.reload();
          };
          this.registerEvent(vault.on("create", arrived));
          this.registerEvent(vault.on("modify", arrived));
        }
      }
      async reload() {
        this.data = await loadTimelineData(this.s.app);
        this.render();
      }
      visible() {
        if (!this.data) return [];
        if (this.focus) {
          const { kind, name } = this.focus;
          return this.data.events.filter((e) => (e[kind] ?? []).includes(name)).sort((a, b) => a.y0 - b.y0 || a.id.localeCompare(b.id));
        }
        const q = this.query.toLowerCase();
        return this.data.events.filter((e) => {
          if (!this.lanes.has(e.lane)) return false;
          if (!this.detail && e.imp > 2) return false;
          if (!e.cat.some((c) => this.cats.has(c))) return false;
          if (q) {
            const hay = [
              e.t,
              e.note,
              ...e.people ?? [],
              ...e.places ?? [],
              ...e.things ?? [],
              ...e.chapters ?? []
            ].join(" ").toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        }).sort((a, b) => a.y0 - b.y0 || a.id.localeCompare(b.id));
      }
      /** every subject the dataset knows, with how often it appears */
      subjectIndex(kind) {
        const counts = /* @__PURE__ */ new Map();
        for (const e of this.data?.events ?? []) {
          for (const name of e[kind] ?? []) {
            counts.set(name, (counts.get(name) ?? 0) + 1);
          }
        }
        return Array.from(counts.entries()).map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
      }
      render() {
        const c = this.contentEl;
        c.empty();
        if (!this.data) {
          const empty = c.createDiv({ cls: "sg-tl-empty" });
          empty.createDiv({
            text: "Timeline data hasn't reached this device yet \u2014 it loads itself the moment it arrives."
          });
          const retry = empty.createEl("button", { cls: "sg-tl-retry", text: "\u21BB Check now" });
          retry.onclick = () => void this.reload();
          return;
        }
        if (this.focus) {
          const meta = SUBJECT_META[this.focus.kind];
          const events = this.visible();
          const bar2 = c.createDiv({ cls: "sg-tl-bar" });
          const banner2 = bar2.createDiv({ cls: "sg-tl-focus" });
          banner2.createSpan({ cls: "sg-tl-focus-emoji", text: meta.emoji });
          const col = banner2.createDiv({ cls: "sg-tl-focus-col" });
          col.createDiv({ cls: "sg-tl-focus-name", text: this.focus.name });
          col.createDiv({
            cls: "sg-tl-focus-sub",
            text: `${events.length} moment${events.length === 1 ? "" : "s"} across time`
          });
          if (this.focus.kind !== "things") {
            const page = banner2.createEl("button", { cls: "sg-tl-focus-btn", text: "\u2197" });
            page.setAttr("aria-label", "Open page");
            const name = this.focus.name;
            page.onclick = () => void this.s.app.workspace.openLinkText(name, "");
          }
          const swap = banner2.createEl("button", { cls: "sg-tl-focus-btn", text: "\u{1F3AF}" });
          swap.setAttr("aria-label", "Focus something else");
          swap.onclick = () => new SubjectPickerModal(
            this.s,
            this,
            (sub) => this.setFocus(sub)
          ).open();
          const exit = banner2.createEl("button", { cls: "sg-tl-focus-btn", text: "\u2715" });
          exit.setAttr("aria-label", "Back to everything");
          exit.onclick = () => this.setFocus(null);
          this.streamEl = c.createDiv({ cls: "sg-tl-stream" });
          this.renderStream();
          return;
        }
        const bar = c.createDiv({ cls: "sg-tl-bar" });
        const eras = bar.createDiv({ cls: "sg-tl-eras" });
        eras.createSpan({ cls: "sg-tl-rowcap", text: "Jump to" });
        for (const era of ERAS) {
          const b = eras.createEl("button", { cls: "sg-tl-era", text: era.label });
          b.setAttr("title", `Scroll to the ${era.label} era`);
          b.onclick = () => this.scrollToYear(era.y);
        }
        const row2 = bar.createDiv({ cls: "sg-tl-row" });
        if (this.data.threads?.length) {
          const seg = row2.createDiv({ cls: "sg-tl-seg" });
          seg.createSpan({ cls: "sg-tl-seg-cap", text: "Depth" });
          const segDefs = [
            [1, "1", "One line per world"],
            [2, "2", "Split the storylines apart"]
          ];
          for (const [d, label, hint] of segDefs) {
            const b = seg.createEl("button", { cls: "sg-tl-seg-btn", text: label });
            b.setAttr("aria-label", hint);
            b.setAttr("title", hint);
            b.toggleClass("sg-tl-seg-on", this.depth === d);
            b.onclick = () => {
              if (this.depth === d) return;
              this.depth = d;
              this.saveDepth();
              this.render();
            };
          }
        }
        for (const key of ["ow", "nw", "rs"]) {
          const on = this.lanes.has(key);
          const b = row2.createEl("button", { cls: "sg-tl-worldc", text: LANE_NAME[key] });
          const hint = `${on ? "Hide" : "Show"} ${LANE_NAME[key].slice(3)} events`;
          b.setAttr("title", hint);
          b.setAttr("aria-label", hint);
          b.style.setProperty("--sg-lane", LANE_COLOR[key]);
          b.toggleClass("sg-tl-on", on);
          b.onclick = () => {
            if (this.lanes.has(key)) this.lanes.delete(key);
            else this.lanes.add(key);
            this.render();
          };
        }
        row2.createSpan({ cls: "sg-tl-div" });
        const iconChip = (text, hint, on, click) => {
          const b = row2.createEl("button", { cls: "sg-tl-tool", text });
          b.setAttr("aria-label", hint);
          b.setAttr("title", hint);
          b.toggleClass("sg-tl-on", on);
          b.onclick = click;
          return b;
        };
        iconChip(
          this.detail ? "\u{1F50E} Everything" : "\u2B50 Major only",
          "How much shows: the major moments, or every detail",
          this.detail,
          () => {
            this.detail = !this.detail;
            this.render();
          }
        );
        iconChip(
          "\u{1F3AF} Focus",
          "Follow one person, place, or thing through time",
          false,
          () => new SubjectPickerModal(this.s, this, (sub) => this.setFocus(sub)).open()
        );
        const filtered = this.cats.size < CATS.length;
        iconChip(
          filtered ? `\u2697 Lenses \xB7 ${this.cats.size}` : "\u2697 Lenses",
          "Filter by kind of moment \u2014 prophets, wars, records\u2026",
          this.showLenses || filtered,
          () => {
            this.showLenses = !this.showLenses;
            this.render();
          }
        );
        iconChip(
          "\u{1F50D} Search",
          "Find a person, place, or event",
          this.showSearch || !!this.query,
          () => {
            this.showSearch = !this.showSearch;
            if (!this.showSearch) {
              this.query = "";
            }
            this.render();
          }
        );
        if (this.lanes.size < 3 || filtered || this.detail || this.query) {
          const reset = row2.createEl("button", { cls: "sg-tl-tool sg-tl-reset", text: "\u21BA Reset" });
          reset.setAttr("title", "Show everything again");
          reset.setAttr("aria-label", "Show everything again");
          reset.onclick = () => this.resetFilters();
        }
        if (this.showLenses) {
          const row3 = bar.createDiv({ cls: "sg-tl-row sg-tl-cats" });
          for (const cat of CATS) {
            const b = row3.createEl("button", { cls: "sg-tl-chip", text: cat.label });
            b.toggleClass("sg-tl-on", this.cats.has(cat.key));
            b.onclick = () => {
              if (this.cats.has(cat.key) && this.cats.size === 1) {
                this.cats = new Set(CATS.map((x) => x.key));
              } else if (this.cats.has(cat.key) && this.cats.size === CATS.length) {
                this.cats = /* @__PURE__ */ new Set([cat.key]);
              } else if (this.cats.has(cat.key)) {
                this.cats.delete(cat.key);
              } else {
                this.cats.add(cat.key);
              }
              this.render();
            };
          }
        }
        if (this.showSearch || this.query) {
          const search = bar.createEl("input", {
            cls: "sg-tl-search",
            attr: { type: "search", placeholder: "Find a person, place, or event\u2026" }
          });
          search.value = this.query;
          search.oninput = () => {
            this.query = search.value;
            this.renderStream();
          };
          if (this.showSearch && !this.query) {
            window.setTimeout(() => search.focus(), 60);
          }
        }
        this.streamEl = c.createDiv({ cls: "sg-tl-stream" });
        this.renderStream();
      }
      yById = /* @__PURE__ */ new Map();
      yByYear = [];
      // [year, yPx]
      /** at depth 2 every storyline earns its own column beside its lane —
       * assigned per lane in dataset order, so new threads slot in on their own */
      threadX(W) {
        const m = /* @__PURE__ */ new Map();
        const used = { ow: 0, nw: 0, rs: 0 };
        for (const t of this.data?.threads ?? []) {
          const lane = THREAD_F[t.lane] ?? THREAD_F.nw;
          m.set(t.id, W * lane[Math.min(used[t.lane]++, lane.length - 1)]);
        }
        return m;
      }
      /** the constellation, laid out in true device pixels: luminous rails with
       * crisp text beside them (git-graph idiom — the open middle belongs to the
       * words), storyline braids at depth 2, narrative arcs between hemispheres */
      renderStream() {
        const stream = this.streamEl;
        if (!stream) return;
        stream.empty();
        this.clearDetail();
        this.yById.clear();
        this.yByYear = [];
        const events = this.visible();
        if (!events.length) {
          const empty = stream.createDiv({ cls: "sg-tl-empty" });
          empty.createDiv({ text: "Nothing matches \u2014 every event is filtered out." });
          const back = empty.createEl("button", { cls: "sg-tl-retry", text: "\u21BA Show everything" });
          back.onclick = () => this.resetFilters();
          return;
        }
        let cw = stream.clientWidth;
        if (cw < 80) {
          cw = 420;
          if (!this.retriedZeroWidth) {
            this.retriedZeroWidth = true;
            window.requestAnimationFrame(() => {
              if ((this.streamEl?.clientWidth ?? 0) > 80) this.renderStream();
            });
          }
        }
        this.lastW = cw;
        const W = cw;
        const colW = Math.min(cw, 820);
        const off = Math.round((cw - colW) / 2);
        const tx = !this.focus && this.depth === 2 ? this.threadX(colW) : /* @__PURE__ */ new Map();
        const threadById = new Map((this.data?.threads ?? []).map((t) => [t.id, t]));
        const laneX = (lane) => off + colW * (LANE_F[lane] ?? 0.5);
        const xFor = (e) => {
          const t = e.thread ? tx.get(e.thread) : void 0;
          return t != null ? off + t : laneX(e.lane);
        };
        const onThread = (e) => !!e.thread && tx.has(e.thread);
        const dirFor = (e) => LANE_DIR[e.lane] ?? 1;
        const hash01 = (s) => {
          let h = 2166136261;
          for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
          }
          return (h >>> 0) / 4294967295;
        };
        const ROW = 78, CENTURY_GAP = 58, ERA_GAP = 66, TOP = 64, BOTTOM = 120;
        let y = TOP;
        let lastCentury = null;
        const centuries = [];
        const eraBands = [];
        let lastEra = null;
        const pos = /* @__PURE__ */ new Map();
        for (const e of events) {
          const century = e.y0 < 0 ? -Math.ceil(-e.y0 / 100) * 100 : Math.floor(Math.max(e.y0 - 1, 0) / 100) * 100 + 1;
          const era = [...ERAS].reverse().find((er) => er.y <= e.y0);
          const eraTurn = !!era && era.label !== lastEra;
          if (eraTurn) {
            lastEra = era.label;
            y += ERA_GAP;
            eraBands.push({ label: era.label, yTop: y - ERA_GAP + 6, wmY: y - 14 });
          }
          if (century !== lastCentury) {
            lastCentury = century;
            y += CENTURY_GAP;
            const page = e.y0 < 0 ? `${-century}-${-(century + 99)} BC` : `AD ${century}-${century + 99}`;
            centuries.push({ y: y - 26, label: page.replace("-", "\u2013"), page, year: century });
            this.yByYear.push([century, y - 26]);
          }
          const amp = onThread(e) ? Math.min(24, colW * 0.03) : Math.min(60, colW * 0.07);
          const jitter = (hash01(e.id) - 0.5) * 2 * amp;
          const z = 0.76 + hash01(e.id + "~z") * 0.44;
          const jx = Math.min(Math.max(xFor(e) + Math.round(jitter), 24), W - 24);
          pos.set(e.id, { x: jx, y, z, e });
          this.yById.set(e.id, y);
          y += ROW;
        }
        const H = y + BOTTOM;
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
        svg.setAttribute("width", String(W));
        svg.setAttribute("height", String(H));
        svg.classList.add("sg-tl-svg");
        const el = (tag, attrs, parent = svg) => {
          const n = document.createElementNS(NS, tag);
          for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
          parent.appendChild(n);
          return n;
        };
        const defs = el("defs", {});
        const filt = el("filter", { id: "sgtlglow", x: "-80%", y: "-80%", width: "260%", height: "260%" }, defs);
        el("feGaussianBlur", { stdDeviation: "4", result: "b" }, filt);
        const merge = el("feMerge", {}, filt);
        el("feMergeNode", { in: "b" }, merge);
        el("feMergeNode", { in: "SourceGraphic" }, merge);
        for (let i = 0; i < eraBands.length; i++) {
          const band = eraBands[i];
          const yEnd = eraBands[i + 1]?.yTop ?? H;
          el("rect", {
            x: "0",
            y: String(band.yTop),
            width: String(W),
            height: String(yEnd - band.yTop),
            class: "sg-tl-band",
            fill: ERA_TINT[band.label] ?? "rgba(255, 255, 255, 0.03)"
          });
          const fs = Math.min(
            Math.round(colW * 0.085),
            64,
            Math.round(colW / (band.label.length * 0.78))
          );
          const wm = el("text", {
            x: String(W / 2),
            y: String(Math.max(band.wmY, TOP + 26)),
            "text-anchor": "middle",
            class: "sg-tl-erawash",
            style: `font-size: ${fs}px`
          });
          wm.textContent = band.label.toUpperCase();
        }
        let seed = 9973;
        const rnd = () => {
          seed = seed * 48271 % 2147483647;
          return seed / 2147483647;
        };
        const nStars = Math.min(44, Math.max(10, Math.round(H / 240)));
        for (let i = 0; i < nStars; i++) {
          el("circle", {
            cx: String(Math.round(rnd() * W)),
            cy: String(Math.round(rnd() * H)),
            r: (0.7 + rnd() * 0.9).toFixed(2),
            class: "sg-tl-star",
            style: `animation-delay: -${(rnd() * 4.2).toFixed(2)}s; animation-duration: ${(3.4 + rnd() * 2.6).toFixed(2)}s`
          });
        }
        const chainPath = (chain) => {
          let d = "";
          for (let i = 0; i < chain.length; i++) {
            const p = chain[i];
            if (i === 0) {
              d = `M ${p.x} ${p.y}`;
              continue;
            }
            const prev = chain[i - 1];
            const midY = (prev.y + p.y) / 2;
            d += ` C ${prev.x} ${midY}, ${p.x} ${midY}, ${p.x} ${p.y}`;
          }
          return d;
        };
        const rail = (d, color, core, coreCls) => {
          el("path", {
            d,
            class: "sg-tl-railglow",
            stroke: color,
            "stroke-width": String(core * 3.2)
          });
          el("path", {
            d,
            class: coreCls,
            stroke: color,
            "stroke-width": String(core)
          });
        };
        const toContent = (ev) => {
          const rc = stream.getBoundingClientRect();
          return [ev.clientX - rc.left, ev.clientY - rc.top + stream.scrollTop];
        };
        const gapHit = (a, b, context, litEl = null, straight = false) => {
          const pa = pos.get(a.id), pb = pos.get(b.id);
          const n = straight ? el("line", {
            x1: String(pa.x),
            y1: String(pa.y),
            x2: String(pb.x),
            y2: String(pb.y),
            class: "sg-tl-hitline",
            "data-a": a.id,
            "data-b": b.id
          }) : el("path", {
            d: chainPath([pa, pb]),
            class: "sg-tl-hitline",
            "data-a": a.id,
            "data-b": b.id
          });
          n.addEventListener("mouseenter", (ev) => {
            litEl?.classList.add("sg-tl-web-lit");
            const [x, y2] = toContent(ev);
            this.showGap(a, b, context, x, y2, false);
          });
          n.addEventListener("mousemove", (ev) => {
            const [x, y2] = toContent(ev);
            this.moveGap(x, y2);
          });
          n.addEventListener("mouseleave", () => {
            if (!litEl?.classList.contains("sg-tl-web-pin")) {
              litEl?.classList.remove("sg-tl-web-lit");
            }
            this.hideGap(false);
          });
          n.addEventListener("click", (ev) => {
            ev.stopPropagation();
            this.clearDetail();
            litEl?.classList.add("sg-tl-web-lit", "sg-tl-web-pin");
            const [x, y2] = toContent(ev);
            this.showGap(a, b, context, x, y2, true);
          });
        };
        if (this.focus) {
          const chain = events.map((e) => pos.get(e.id));
          if (chain.length > 1) el("path", { d: chainPath(chain), class: "sg-tl-focus-thread" });
          const fmeta = SUBJECT_META[this.focus.kind];
          for (let i = 1; i < events.length; i++) {
            gapHit(events[i - 1], events[i], `${fmeta.emoji} ${this.focus.name}`);
          }
        } else {
          for (const lane of ["ow", "nw", "rs"]) {
            const laneEvents = events.filter((e) => e.lane === lane && !onThread(e));
            const chain = laneEvents.map((e) => pos.get(e.id));
            if (chain.length >= 2) rail(chainPath(chain), LANE_COLOR[lane], 2, "sg-tl-thread");
            for (let i = 1; i < laneEvents.length; i++) {
              gapHit(laneEvents[i - 1], laneEvents[i], LANE_NAME[lane]);
            }
            if (laneEvents.length) {
              const first = pos.get(laneEvents[0].id);
              const dir = LANE_DIR[lane] ?? 1;
              const cap = el("text", {
                x: String(first.x + dir * 16),
                y: String(first.y - 46),
                "text-anchor": dir > 0 ? "start" : "end",
                class: "sg-tl-tcap",
                fill: LANE_COLOR[lane]
              });
              cap.textContent = LANE_NAME[lane];
            }
          }
          if (tx.size) {
            for (const th of this.data?.threads ?? []) {
              const members = events.filter((e) => e.thread === th.id);
              if (!members.length) continue;
              const chain = members.map((e) => pos.get(e.id));
              if (chain.length > 1) rail(chainPath(chain), th.color, 1.6, "sg-tl-thread2");
              for (let i = 1; i < members.length; i++) {
                gapHit(members[i - 1], members[i], `\u21B3 ${th.label}`);
              }
              const first = chain[0], last = chain[chain.length - 1];
              if (th.branch) {
                const from = pos.get(th.branch) ?? { x: laneX(th.lane), y: first.y - 56 };
                const midA = (from.y + first.y) / 2;
                el("path", {
                  d: `M ${from.x} ${from.y} C ${from.x} ${midA}, ${first.x} ${midA}, ${first.x} ${first.y}`,
                  class: "sg-tl-branch",
                  stroke: th.color
                });
              }
              if (th.merges) {
                const back = events.find((e) => e.lane === th.lane && !onThread(e) && (pos.get(e.id)?.y ?? 0) > last.y);
                const to = back ? pos.get(back.id) : { x: laneX(th.lane), y: last.y + 56 };
                const midB = (last.y + to.y) / 2;
                el("path", {
                  d: `M ${last.x} ${last.y} C ${last.x} ${midB}, ${to.x} ${midB}, ${to.x} ${to.y}`,
                  class: "sg-tl-branch",
                  stroke: th.color
                });
              }
              const dir = LANE_DIR[th.lane] ?? 1;
              const cap = el("text", {
                x: String(first.x + dir * 14),
                y: String(first.y - 42),
                "text-anchor": dir > 0 ? "start" : "end",
                class: "sg-tl-tcap sg-tl-tcap-sm",
                fill: th.color
              });
              cap.textContent = `${th.branch ? "\u21B3 " : ""}${th.label}`;
            }
          }
          const railPairs = /* @__PURE__ */ new Set();
          const markChain = (chain) => {
            for (let i = 1; i < chain.length; i++) {
              railPairs.add(`${chain[i - 1].id}|${chain[i].id}`);
            }
          };
          for (const lane of ["ow", "nw", "rs"]) {
            markChain(events.filter((e) => e.lane === lane && !onThread(e)));
          }
          for (const th of this.data?.threads ?? []) {
            markChain(events.filter((e) => e.thread === th.id));
          }
          const bySubject = /* @__PURE__ */ new Map();
          for (const e of events) {
            const tagged = [
              ...(e.people ?? []).map((n) => `\u{1F9D1} ${n}`),
              ...(e.things ?? []).map((n) => `\u{1F4E6} ${n}`)
            ];
            for (const s of tagged) {
              const arr = bySubject.get(s) ?? [];
              arr.push(e);
              bySubject.set(s, arr);
            }
          }
          const webPairs = /* @__PURE__ */ new Map();
          const addPair = (a, b, subject) => {
            if (a === b) return;
            const key = a < b ? `${a}|${b}` : `${b}|${a}`;
            if (railPairs.has(`${a}|${b}`) || railPairs.has(`${b}|${a}`)) return;
            if (!webPairs.has(key)) webPairs.set(key, [a, b, subject]);
          };
          for (const [subject, evs] of bySubject) {
            if (evs.length < 2 || evs.length > 9) continue;
            for (let i = 1; i < evs.length; i++) {
              addPair(evs[i - 1].id, evs[i].id, subject);
            }
          }
          const visibleIds = new Set(events.map((e) => e.id));
          for (const [a, b] of NARRATIVE_LINKS) {
            if (visibleIds.has(a) && visibleIds.has(b)) addPair(a, b, null);
          }
          const strong = new Set(NARRATIVE_LINKS.map(([a, b]) => a < b ? `${a}|${b}` : `${b}|${a}`));
          for (const [key, [a, b, subject]] of webPairs) {
            const pa = pos.get(a), pb = pos.get(b);
            const dy = Math.abs(pb.y - pa.y);
            const o = Math.max(0.05, (strong.has(key) ? 0.24 : 0.17) - dy / 14e3);
            const line = el("line", {
              x1: String(pa.x),
              y1: String(pa.y),
              x2: String(pb.x),
              y2: String(pb.y),
              class: "sg-tl-web",
              "data-a": a,
              "data-b": b,
              style: `stroke-opacity: ${o.toFixed(3)}`
            });
            gapHit(pa.e, pb.e, subject, line, true);
          }
          const q = this.query.trim().toLowerCase();
          if (q.length >= 3) {
            const hits = events.filter((e) => (e.people ?? []).some((p) => p.toLowerCase().includes(q)));
            for (let i = 1; i < hits.length; i++) {
              const pa = pos.get(hits[i - 1].id), pb = pos.get(hits[i].id);
              el("path", {
                d: `M ${pa.x} ${pa.y} Q ${(pa.x + pb.x) / 2 + 40} ${(pa.y + pb.y) / 2}, ${pb.x} ${pb.y}`,
                class: "sg-tl-spot"
              });
            }
          }
        }
        for (const c of centuries) {
          const t = el("text", {
            x: String(W / 2),
            y: String(c.y),
            "text-anchor": "middle",
            class: "sg-tl-century"
          });
          t.textContent = c.label;
          t.onclick = () => {
            void this.s.app.workspace.openLinkText(`AI Library/90 Timeline/${c.page}.md`, "");
          };
        }
        let nodeIdx = 0;
        for (const e of events) {
          const p = pos.get(e.id);
          const r = (e.imp === 1 ? 9 : e.imp === 2 ? 6.5 : 4.5) * p.z;
          const braided = onThread(e);
          const color = (braided && e.thread ? threadById.get(e.thread)?.color : void 0) ?? LANE_COLOR[e.lane];
          const outer = el("g", {
            class: "sg-tl-node",
            "data-id": e.id,
            // constellation lights up star by star
            style: `animation-delay: ${Math.min(nodeIdx * 22, 480)}ms`
          });
          const g = el("g", {
            class: "sg-tl-float",
            style: `animation-delay: -${(hash01(e.id + "~f") * 8).toFixed(2)}s; animation-duration: ${(6.5 + hash01(e.id + "~d") * 4).toFixed(2)}s`
          }, outer);
          nodeIdx++;
          el("circle", {
            cx: String(p.x),
            cy: String(p.y),
            r: "24",
            class: "sg-tl-hit"
          }, g);
          el("circle", {
            cx: String(p.x),
            cy: String(p.y),
            r: String((r + 7).toFixed(1)),
            fill: color,
            class: e.imp === 1 ? "sg-tl-halo sg-tl-halo-breathe" : "sg-tl-halo",
            style: e.imp === 1 ? `animation-delay: -${nodeIdx % 7 * 0.8}s` : ""
          }, g);
          el("circle", {
            cx: String(p.x),
            cy: String(p.y),
            r: String(r),
            fill: color,
            filter: "url(#sgtlglow)",
            class: "sg-tl-dot"
          }, g);
          el("circle", {
            cx: String(p.x - r * 0.3),
            cy: String(p.y - r * 0.3),
            r: String(Math.max(1.1, r * 0.28)),
            class: "sg-tl-glint"
          }, g);
          const dir = dirFor(e);
          const tx0 = p.x + dir * (r + 12);
          const avail = dir > 0 ? W - 16 - tx0 : tx0 - 16;
          const per = e.imp === 1 && !braided ? 7.2 : 6.2;
          const maxCh = Math.max(10, Math.floor(avail / per));
          const label = e.t.length > maxCh ? `${e.t.slice(0, maxCh - 1)}\u2026` : e.t;
          const cls = braided ? "sg-tl-label sg-tl-label-sm" : e.imp === 1 ? "sg-tl-label sg-tl-label-big" : e.imp === 3 ? "sg-tl-label sg-tl-label-sm" : "sg-tl-label";
          const anchor = dir > 0 ? "start" : "end";
          const t1 = el("text", {
            x: String(tx0),
            y: String(p.y - 2),
            "text-anchor": anchor,
            class: cls,
            "data-avail": String(Math.max(56, Math.round(avail)))
          }, g);
          t1.textContent = label;
          const t2 = el("text", {
            x: String(tx0),
            y: String(p.y + 14),
            "text-anchor": anchor,
            class: "sg-tl-year",
            fill: color
          }, g);
          t2.textContent = `${yearStr(e.y0)} \xB7 ${DATING_SHORT[e.dating] ?? e.dating}`;
          outer.onclick = () => this.selectNode(e, outer);
        }
        stream.appendChild(svg);
        svg.querySelectorAll("text[data-avail]").forEach((node) => {
          const t = node;
          if (typeof t.getComputedTextLength !== "function") return;
          const fit = Number(t.getAttribute("data-avail"));
          if (!fit || t.getComputedTextLength() <= fit) return;
          let base = (t.textContent ?? "").replace(/…$/, "");
          while (base.length > 6 && t.getComputedTextLength() > fit) {
            base = base.slice(0, -1);
            t.textContent = base.trimEnd() + "\u2026";
          }
        });
        svg.addEventListener("click", (evt) => {
          if (evt.target.closest(".sg-tl-node, .sg-tl-hitline")) return;
          this.clearDetail();
        });
        if (this.pendingYear != null) {
          const py = this.pendingYear;
          this.pendingYear = null;
          window.setTimeout(() => this.scrollToYear(py), 60);
        }
      }
      detailEl = null;
      clearDetail() {
        this.detailEl?.remove();
        this.detailEl = null;
        this.hideGap(true);
        this.streamEl?.querySelectorAll(".sg-tl-sel").forEach((n) => n.classList.remove("sg-tl-sel"));
        this.streamEl?.querySelectorAll(".sg-tl-web-lit").forEach((n) => n.classList.remove("sg-tl-web-lit", "sg-tl-web-pin"));
      }
      // ---- the time-between chip: floats at an edge's midpoint --------------
      gapEl = null;
      gapPinned = false;
      showGap(a, b, context, x, y, pin) {
        if (this.gapPinned && !pin) return;
        this.gapEl?.remove();
        this.gapEl = null;
        this.gapPinned = pin;
        const stream = this.streamEl;
        if (!stream) return;
        const [ea, eb] = a.y0 <= b.y0 ? [a, b] : [b, a];
        const delta = eb.y0 - ea.y0;
        const soft = [ea.dating, eb.dating].some((d) => d === "traditional" || d === "approximate");
        const chip = stream.createDiv({ cls: "sg-tl-gap" });
        chip.createDiv({
          cls: "sg-tl-gap-main",
          text: delta === 0 ? "the same years" : `${soft ? "\u2248 " : ""}${delta.toLocaleString()} year${delta === 1 ? "" : "s"} apart`
        });
        chip.createDiv({
          cls: "sg-tl-gap-sub",
          text: `${context ? context + " \xB7 " : ""}${yearStr(ea.y0)} \u2192 ${yearStr(eb.y0)}`
        });
        this.gapEl = chip;
        this.placeGap(x, y);
      }
      /** anchor the chip at (x, y) content coords, clamped INSIDE the visible
       * viewport — a long edge's far reaches never strand the answer offscreen */
      placeGap(x, y) {
        const stream = this.streamEl, chip = this.gapEl;
        if (!stream || !chip) return;
        const cx = Math.min(Math.max(x, 96), Math.max(200, stream.clientWidth - 96));
        const top = stream.scrollTop;
        const cy = Math.min(Math.max(y, top + 14), top + stream.clientHeight - 20);
        chip.toggleClass("sg-tl-gap-below", cy - top < 76);
        chip.style.left = `${Math.round(cx)}px`;
        chip.style.top = `${Math.round(cy)}px`;
      }
      /** the transient chip follows the pointer along the line */
      moveGap(x, y) {
        if (this.gapPinned) return;
        this.placeGap(x, y);
      }
      hideGap(force) {
        if (this.gapPinned && !force) return;
        this.gapEl?.remove();
        this.gapEl = null;
        if (force) this.gapPinned = false;
      }
      /** the tapped node lights up; its web connections glow; its story slides
       * in at the bottom */
      selectNode(e, g) {
        this.clearDetail();
        g.classList.add("sg-tl-sel");
        this.streamEl?.querySelectorAll(".sg-tl-web").forEach((l) => {
          if (l.getAttribute("data-a") === e.id || l.getAttribute("data-b") === e.id) {
            l.classList.add("sg-tl-web-lit");
          }
        });
        const card = this.contentEl.createDiv({ cls: "sg-tl-detail" });
        this.detailEl = card;
        const yr = e.y0 === e.y1 ? yearStr(e.y0) : `${yearStr(e.y0)} \u2013 ${yearStr(e.y1)}`;
        const head = card.createDiv({ cls: "sg-tl-detail-head" });
        head.createSpan({ cls: "sg-tl-detail-year", text: `${yr} \xB7 ${DATING_SHORT[e.dating] ?? e.dating}` });
        const close = head.createEl("button", { cls: "sg-tl-detail-x", text: "\u2715" });
        close.onclick = () => this.clearDetail();
        card.createDiv({ cls: "sg-tl-detail-title", text: e.t });
        card.createDiv({ cls: "sg-tl-detail-note", text: e.note });
        const links = card.createDiv({ cls: "sg-tl-links" });
        const focusChip = (kind, name) => {
          const b = links.createEl("button", {
            cls: "sg-tl-link",
            text: `${SUBJECT_META[kind].emoji} ${name}`
          });
          b.onclick = () => this.setFocus({ kind, name });
        };
        for (const p of (e.people ?? []).slice(0, 3)) focusChip("people", p);
        for (const p of (e.places ?? []).slice(0, 2)) focusChip("places", p);
        for (const th of (e.things ?? []).slice(0, 3)) focusChip("things", th);
        for (const ch of (e.chapters ?? []).slice(0, 3)) {
          const b = links.createEl("button", { cls: "sg-tl-link sg-tl-link-ref", text: `\u{1F4D6} ${ch}` });
          b.onclick = () => void this.s.app.workspace.openLinkText(ch, "");
        }
      }
      scrollToYear(y) {
        const stream = this.streamEl;
        if (!stream) return;
        const hit = this.yByYear.find(([yr]) => yr >= y) ?? this.yByYear[this.yByYear.length - 1];
        if (!hit) return;
        stream.scrollTo({ top: Math.max(0, hit[1] - 64), behavior: "smooth" });
      }
      async onClose() {
        window.removeEventListener("resize", this.boundResize);
        this.contentEl.empty();
      }
      /** exposed for the picker: every subject with its appearance count */
      subjectsOf(kind) {
        return this.subjectIndex(kind);
      }
    };
    SubjectPickerModal = class extends import_obsidian6.Modal {
      constructor(s, view, onPick) {
        super(s.app);
        this.view = view;
        this.onPick = onPick;
      }
      query = "";
      listEl = null;
      onOpen() {
        registerSheet(this);
        this.modalEl.addClass("sg-tlp-modal");
        const c = this.contentEl;
        c.addClass("sg-tlp");
        c.createEl("h3", { cls: "sg-tlp-title", text: "\u{1F3AF} Focus the timeline on\u2026" });
        const search = c.createEl("input", {
          cls: "sg-nav-filter",
          attr: { type: "search", placeholder: "Type a name \u2014 Nephi, Jerusalem, Gold Plates\u2026" }
        });
        search.oninput = () => {
          this.query = search.value;
          this.renderList();
        };
        this.listEl = c.createDiv({ cls: "sg-tlp-list" });
        this.renderList();
        window.setTimeout(() => search.focus(), 80);
      }
      renderList() {
        const list = this.listEl;
        if (!list) return;
        list.empty();
        const q = this.query.trim().toLowerCase();
        for (const kind of ["things", "people", "places"]) {
          const subjects = this.view.subjectsOf(kind).filter((s) => !q || s.name.toLowerCase().includes(q)).slice(0, q ? 12 : 8);
          if (!subjects.length) continue;
          list.createDiv({ cls: "sg-nav-sect", text: `${SUBJECT_META[kind].emoji} ${SUBJECT_META[kind].label}` });
          for (const s of subjects) {
            const row = list.createDiv({ cls: "sg-nav-row" });
            row.createSpan({ cls: "sg-nav-emoji", text: SUBJECT_META[kind].emoji });
            row.createSpan({ cls: "sg-nav-name", text: s.name });
            row.createSpan({ cls: "sg-tlp-count", text: `${s.n}` });
            row.onclick = () => {
              this.close();
              this.onPick({ kind, name: s.name });
            };
          }
        }
        if (!list.childElementCount) {
          list.createDiv({ cls: "sg-nav-empty", text: "No one and nothing by that name yet." });
        }
      }
      onClose() {
        unregisterSheet(this);
        this.contentEl.empty();
      }
    };
  }
});

// src/study/tagFeel.ts
function normalize2(s) {
  return s.toLowerCase().normalize("NFKD").replace(COMBINING, "").replace(/[^a-z0-9 ]+/g, " ").replace(/ +/g, " ").trim();
}
function stem2(word) {
  let w = word;
  for (let again = true; again; ) {
    again = false;
    for (const sfx of SUFFIXES2) {
      if (!w.endsWith(sfx) || w.length - sfx.length < 3) continue;
      if (sfx === "s" && w.endsWith("ss")) continue;
      if (sfx === "es" && !/(?:s|x|z|ch|sh)es$/.test(w)) continue;
      w = w.slice(0, -sfx.length);
      again = true;
      break;
    }
  }
  return w;
}
function lookup(norm) {
  const hit = FEEL_INDEX.get(norm) ?? FEEL_INDEX.get(stem2(norm));
  if (hit) return hit;
  if (norm.includes(" ")) {
    for (const tok of norm.split(" ")) {
      const t = FEEL_INDEX.get(tok) ?? FEEL_INDEX.get(stem2(tok));
      if (t) return t;
    }
  }
  return null;
}
function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function feelSpec(name, taken) {
  const used = /* @__PURE__ */ new Set();
  for (const e of taken) used.add(bare(e));
  const norm = normalize2(name);
  const entry = lookup(norm);
  const h = fnv1a(norm);
  const slot = POOL[h % POOL.length];
  const mood = entry ?? slot;
  const candidates = entry ? entry.e : slot.e;
  for (const c of candidates) {
    if (!used.has(bare(c))) return { emoji: c, c1: mood.c1, c2: mood.c2 };
  }
  for (let i = 0; i < POOL.length; i++) {
    const c = POOL[(h + i) % POOL.length].e[0];
    if (!used.has(bare(c))) return { emoji: c, c1: mood.c1, c2: mood.c2 };
  }
  return { emoji: candidates[0] ?? "\u{1F3F7}\uFE0F", c1: mood.c1, c2: mood.c2 };
}
var LEXICON, SYNONYMS, POOL, COMBINING, SUFFIXES2, FEEL_INDEX, VS16, bare;
var init_tagFeel = __esm({
  "src/study/tagFeel.ts"() {
    "use strict";
    LEXICON = {
      // inner weather — virtues and their shadows
      "pride": { e: ["\u{1F99A}", "\u{1F451}", "\u{1FA9E}"], c1: "#7b2d8b", c2: "#c0392b" },
      // haughty, hot
      "meekness": { e: ["\u{1F411}", "\u{1F54A}\uFE0F", "\u{1F33E}"], c1: "#efe9dc", c2: "#9cc3e4" },
      // wool & dove
      "humility": { e: ["\u{1F647}", "\u{1F33F}", "\u{1F6D0}"], c1: "#8f9779", c2: "#d9e4d0" },
      "obedience": { e: ["\u{1F9ED}", "\u{1F4CF}", "\u2705"], c1: "#4a6fa5", c2: "#9db8d9" },
      "patience": { e: ["\u{1F422}", "\u23F3", "\u{1F33E}"], c1: "#c2a24b", c2: "#e8dcc0" },
      "gratitude": { e: ["\u{1F33B}", "\u{1F64C}"], c1: "#f2b134", c2: "#ffe08a" },
      "courage": { e: ["\u{1F981}", "\u{1F6E1}\uFE0F", "\u{1F525}"], c1: "#d64a2e", c2: "#f5a623" },
      "fear": { e: ["\u{1F628}", "\u{1F311}", "\u{1FAE3}"], c1: "#4a5568", c2: "#1f2733" },
      "anger": { e: ["\u{1F30B}", "\u{1F4A2}", "\u26A1"], c1: "#b91c1c", c2: "#7f1d1d" },
      "peace": { e: ["\u{1F54A}\uFE0F", "\u{1F30A}", "\u{1F343}"], c1: "#7fb8a4", c2: "#cfe8e0" },
      "mercy": { e: ["\u{1F932}", "\u{1F4A7}", "\u{1FAC2}"], c1: "#5eb0b7", c2: "#cdeeea" },
      "justice": { e: ["\u2696\uFE0F", "\u{1F3DB}\uFE0F"], c1: "#37474f", c2: "#78909c" },
      "grace": { e: ["\u{1F9A2}", "\u2728", "\u{1F337}"], c1: "#d9b8d9", c2: "#f3e6f3" },
      "temptation": { e: ["\u{1F34E}", "\u{1F40D}", "\u{1FAA4}"], c1: "#6b8e23", c2: "#c0392b" },
      "kindness": { e: ["\u{1F917}", "\u{1F36F}", "\u{1F33C}"], c1: "#f4a261", c2: "#ffe5b4" },
      "honesty": { e: ["\u{1F48E}", "\u{1FA9E}", "\u2696\uFE0F"], c1: "#6fc2d0", c2: "#e8f9fb" },
      "integrity": { e: ["\u{1F9F1}", "\u{1F332}", "\u{1F5FF}"], c1: "#6b4f3a", c2: "#a3b18a" },
      "virtue": { e: ["\u{1F90D}", "\u{1F337}", "\u{1F6E1}\uFE0F"], c1: "#dba8bc", c2: "#f9f1f4" },
      "love": { e: ["\u{1F497}", "\u{1F339}", "\u{1F49E}"], c1: "#e75480", c2: "#ffc0cb" },
      "trust": { e: ["\u{1FAA2}", "\u{1F932}", "\u26F0\uFE0F"], c1: "#468faf", c2: "#bde0fe" },
      "doubt": { e: ["\u2754", "\u{1F301}", "\u{1F32B}\uFE0F"], c1: "#7d8597", c2: "#c2c7d0" },
      "unity": { e: ["\u{1F9E9}", "\u2B55", "\u{1FAA2}"], c1: "#386fa4", c2: "#59a96a" },
      "contention": { e: ["\u{1F5EF}\uFE0F", "\u26A1", "\u{1F329}\uFE0F"], c1: "#9d0208", c2: "#370617" },
      // doctrine & ordinances
      "testimony": { e: ["\u{1F525}", "\u{1F56F}\uFE0F"], c1: "#ff7043", c2: "#ffd54f" },
      // burning bosom
      "sacrifice": { e: ["\u{1F40F}", "\u{1FA78}", "\u26F0\uFE0F"], c1: "#8b1e2d", c2: "#5d4a4a" },
      "atonement": { e: ["\u{1FAD2}", "\u{1F377}", "\u{1FA78}"], c1: "#5a6e3a", c2: "#6d1f3e" },
      // olive press, wine-dark
      "deliverance": { e: ["\u{1F985}", "\u{1F30A}", "\u{1F5DD}\uFE0F"], c1: "#1f6f8b", c2: "#ffd166" },
      "endurance": { e: ["\u{1F3D4}\uFE0F", "\u{1F97E}"], c1: "#5c6b73", c2: "#9db4c0" },
      "zion": { e: ["\u{1F304}", "\u{1F3D9}\uFE0F", "\u26F0\uFE0F"], c1: "#f0c75e", c2: "#7ea8be" },
      "temple": { e: ["\u{1F3DB}\uFE0F", "\u2728", "\u{1F54A}\uFE0F"], c1: "#f5f0e1", c2: "#d4af37" },
      "priesthood": { e: ["\u{1F5DD}\uFE0F", "\u{1F4EF}", "\u{1F64C}"], c1: "#1e3a5f", c2: "#d4a017" },
      "fasting": { e: ["\u{1F963}", "\u23F3", "\u{1F305}"], c1: "#c9b79c", c2: "#f7ecd9" },
      "sabbath": { e: ["\u{1F324}\uFE0F", "\u26EA", "\u{1F56F}\uFE0F"], c1: "#a3c4f3", c2: "#e6f0fa" },
      "resurrection": { e: ["\u{1F98B}", "\u{1F305}", "\u{1F337}"], c1: "#ff8c42", c2: "#ffe29a" },
      "salvation": { e: ["\u{1F6DF}", "\u2693", "\u{1F305}"], c1: "#e63946", c2: "#f1faee" },
      "agency": { e: ["\u{1F500}", "\u{1F6AA}", "\u{1F9ED}"], c1: "#2a9d8f", c2: "#9b5de5" },
      "revelation": { e: ["\u{1F320}", "\u26A1", "\u{1F526}"], c1: "#1d2d50", c2: "#f2c14e" },
      "angels": { e: ["\u{1F47C}", "\u{1F3BA}", "\u2728"], c1: "#f2e3b6", c2: "#fdfaf0" },
      "miracles": { e: ["\u{1F31F}", "\u{1F4AB}", "\u2728"], c1: "#8e7cc3", c2: "#ffd966" },
      "healing": { e: ["\u{1F33F}", "\u{1FA79}", "\u{1FAC2}"], c1: "#57a773", c2: "#c8e6c9" },
      "baptism": { e: ["\u{1F4A7}", "\u{1F30A}", "\u{1F54A}\uFE0F"], c1: "#4ea8de", c2: "#d0efff" },
      "spirit": { e: ["\u{1F4A8}", "\u{1F525}", "\u{1F54A}\uFE0F"], c1: "#89c2d9", c2: "#fdf0d5" },
      // still, small
      "eternal life": { e: ["\u267E\uFE0F", "\u{1F333}", "\u{1F320}"], c1: "#4a2c82", c2: "#f2c94c" },
      "scripture": { e: ["\u{1F4D6}", "\u{1F4DC}", "\u{1F58B}\uFE0F"], c1: "#a67c52", c2: "#e8d8b8" },
      "prophet": { e: ["\u{1F5FC}", "\u{1F4E2}"], c1: "#22344a", c2: "#e0b84c" },
      // watchman on the tower
      "faith": { e: ["\u{1F331}", "\u{1FAB4}", "\u26F0\uFE0F"], c1: "#4cc38a", c2: "#a8e6c1" },
      // for "faithfulness"
      "hope": { e: ["\u{1F305}", "\u2693", "\u{1F308}"], c1: "#ff9f45", c2: "#ffd166" },
      "prayer": { e: ["\u{1F64F}", "\u{1F6D0}", "\u{1F56F}\uFE0F"], c1: "#b197fc", c2: "#74c0fc" },
      // the story of the covenant people
      "missionary work": { e: ["\u{1F30D}", "\u{1F4E3}", "\u{1F6B2}"], c1: "#2f6690", c2: "#81c3d7" },
      "gathering": { e: ["\u{1F9FA}", "\u{1FABA}", "\u{1F450}"], c1: "#a9714b", c2: "#ecd9c6" },
      "apostasy": { e: ["\u{1F32B}\uFE0F", "\u{1F940}", "\u26D3\uFE0F"], c1: "#6e6a6f", c2: "#3b3740" },
      "restoration": { e: ["\u{1F333}", "\u{1F324}\uFE0F", "\u{1F6E0}\uFE0F"], c1: "#3f7d20", c2: "#ffe8a1" },
      // grove morning
      "liberty": { e: ["\u{1F6A9}", "\u{1F5FD}", "\u{1F985}"], c1: "#c1121f", c2: "#669bbc" },
      // title of liberty
      "exodus": { e: ["\u{1F3DC}\uFE0F", "\u{1F463}", "\u{1F42B}"], c1: "#d9a066", c2: "#7b5e7b" },
      // sand → dusk
      "promised land": { e: ["\u{1F3DE}\uFE0F", "\u{1F347}", "\u{1F304}"], c1: "#2d6a4f", c2: "#f4d35e" },
      "remnant": { e: ["\u{1F9F5}", "\u{1FAA1}"], c1: "#997b66", c2: "#d5bda2" },
      "adoption": { e: ["\u{1FAC2}", "\u{1F49E}", "\u{1FABA}"], c1: "#c86b85", c2: "#f7e1d7" },
      "second coming": { e: ["\u{1F3BA}", "\u2601\uFE0F", "\u{1F307}"], c1: "#f9a825", c2: "#b0bec5" },
      "judgment": { e: ["\u2696\uFE0F", "\u{1F4D6}", "\u{1F514}"], c1: "#424874", c2: "#c9b458" },
      "creation": { e: ["\u{1F30E}", "\u{1F40B}", "\u2728"], c1: "#0b7a75", c2: "#7bdff2" },
      "war": { e: ["\u2694\uFE0F", "\u{1F6E1}\uFE0F", "\u{1F3F9}"], c1: "#7f1d1d", c2: "#4b5563" },
      // the imagery of the word
      "light": { e: ["\u{1F506}", "\u{1F31E}", "\u{1F56F}\uFE0F"], c1: "#ffd93d", c2: "#fffde7" },
      "darkness": { e: ["\u{1F311}", "\u{1F987}", "\u{1F31A}"], c1: "#1a1a2e", c2: "#3d3d5c" },
      "knowledge": { e: ["\u{1F4DA}", "\u{1F9E0}", "\u{1F50D}"], c1: "#303f9f", c2: "#4dd0e1" },
      "shepherd": { e: ["\u{1F411}", "\u{1F304}", "\u{1F9AF}"], c1: "#4f772d", c2: "#b5d99c" },
      "living water": { e: ["\u26F2", "\u{1F4A7}", "\u{1F30A}"], c1: "#0096c7", c2: "#caf0f8" },
      "bread of life": { e: ["\u{1F35E}", "\u{1F956}", "\u{1F33E}"], c1: "#c07830", c2: "#f5deb3" },
      "rock": { e: ["\u{1FAA8}", "\u26F0\uFE0F", "\u{1F5FB}"], c1: "#57606f", c2: "#a4b0be" },
      "refuge": { e: ["\u{1F3F0}", "\u2602\uFE0F", "\u{1F6D6}"], c1: "#2c4a6e", c2: "#a9c2de" },
      "harvest": { e: ["\u{1F33E}", "\u{1F347}", "\u{1F69C}"], c1: "#d69e2e", c2: "#f6e05e" },
      // the shape of a life
      "work": { e: ["\u{1F41D}", "\u{1F6E0}\uFE0F", "\u{1F4AA}"], c1: "#cc8500", c2: "#ffe0a3" },
      // deseret
      "rest": { e: ["\u{1F6CC}", "\u{1F319}", "\u{1FAB7}"], c1: "#7c6fb0", c2: "#cbc3e3" },
      "music": { e: ["\u{1F3B5}", "\u{1F3B6}", "\u{1F3BB}"], c1: "#7d5ba6", c2: "#4ecdc4" },
      "children": { e: ["\u{1F9D2}", "\u{1F388}", "\u{1FA81}"], c1: "#4fc3f7", c2: "#ffe082" },
      "marriage": { e: ["\u{1F48D}", "\u{1FAF6}", "\u{1F54A}\uFE0F"], c1: "#d4af37", c2: "#f7cad0" },
      "death": { e: ["\u{1F940}", "\u26B0\uFE0F", "\u{1F342}"], c1: "#4e4562", c2: "#8a8395" },
      "mourning": { e: ["\u{1F622}", "\u{1F5A4}", "\u{1F327}\uFE0F"], c1: "#556577", c2: "#aab6c4" },
      "hope in christ": { e: ["\u2693", "\u{1F304}", "\u271D\uFE0F"], c1: "#16425b", c2: "#ffb703" },
      // anchor of the soul
      "adversity": { e: ["\u{1F32A}\uFE0F", "\u26C8\uFE0F", "\u{1F9D7}"], c1: "#3e5c76", c2: "#748cab" },
      "riches": { e: ["\u{1F4B0}", "\u{1FA99}", "\u{1F3FA}"], c1: "#c9a227", c2: "#14532d" },
      "poverty": { e: ["\u{1F9CE}", "\u{1F450}", "\u{1FAAB}"], c1: "#7f7053", c2: "#b8ad9e" }
    };
    SYNONYMS = {
      "humble": "humility",
      "humbled": "humility",
      "meek": "meekness",
      "gentle": "meekness",
      "vanity": "pride",
      "vain": "pride",
      "arrogance": "pride",
      "arrogant": "pride",
      "haughty": "pride",
      "boastful": "pride",
      "scared": "fear",
      "afraid": "fear",
      "dread": "fear",
      "obedient": "obedience",
      "obey": "obedience",
      "thank": "gratitude",
      "grateful": "gratitude",
      "brave": "courage",
      "bravery": "courage",
      "valiant": "courage",
      "strength": "courage",
      "wrath": "anger",
      "fury": "anger",
      "calm": "peace",
      "compassion": "mercy",
      "endure": "endurance",
      "perseverance": "endurance",
      "tempt": "temptation",
      "redeemer": "atonement",
      "redemption": "atonement",
      "sacrament": "atonement",
      "savior": "salvation",
      "saved": "salvation",
      "save": "salvation",
      "passover": "deliverance",
      "grief": "mourning",
      "sorrow": "mourning",
      "sad": "mourning",
      "learn": "knowledge",
      "intelligence": "knowledge",
      "truth": "knowledge",
      "melchizedek": "priesthood",
      "aaronic": "priesthood",
      "ordinance": "temple",
      "sealing": "marriage",
      "eternity": "eternal life",
      "eternal": "eternal life",
      "millennium": "second coming",
      "tribulation": "adversity",
      "trial": "adversity",
      "affliction": "adversity",
      "suffering": "adversity",
      "babylon": "apostasy",
      "idol": "apostasy",
      "idolatry": "apostasy",
      "wander": "exodus",
      "wilderness": "exodus",
      "desert": "exodus",
      "israel": "gathering",
      "missionary": "missionary work",
      "mission": "missionary work",
      "preach": "missionary work",
      "water": "living water",
      "bread": "bread of life",
      "holy ghost": "spirit",
      "holy spirit": "spirit",
      "comforter": "spirit",
      "pray": "prayer",
      "sing": "music",
      "hymn": "music",
      "miracle": "miracles",
      "angel": "angels",
      "child": "children",
      "rich": "riches"
    };
    POOL = [
      { e: ["\u{1F9FF}"], c1: "#1f6feb", c2: "#8ab4ff" },
      { e: ["\u{1F34A}"], c1: "#e8590c", c2: "#ffc078" },
      { e: ["\u{1F335}"], c1: "#2b8a3e", c2: "#8ce99a" },
      { e: ["\u{1F41A}"], c1: "#e64980", c2: "#ffc9d8" },
      { e: ["\u{1FABB}"], c1: "#6741d9", c2: "#b197fc" },
      { e: ["\u{1F9CA}"], c1: "#15aabf", c2: "#99e9f2" },
      { e: ["\u{1F336}\uFE0F"], c1: "#c92a2a", c2: "#ff8787" },
      { e: ["\u{1F95D}"], c1: "#66a80f", c2: "#c0eb75" },
      { e: ["\u{1F433}"], c1: "#1864ab", c2: "#74c0fc" },
      { e: ["\u{1FA85}"], c1: "#d6336c", c2: "#faa2c1" },
      { e: ["\u{1F341}"], c1: "#d9480f", c2: "#ff922b" },
      { e: ["\u{1F99C}"], c1: "#0b7285", c2: "#63e6be" },
      { e: ["\u{1FAD0}"], c1: "#364fc7", c2: "#91a7ff" },
      { e: ["\u{1F3EE}"], c1: "#f08c00", c2: "#ffe066" },
      { e: ["\u{1FA90}"], c1: "#5f3dc4", c2: "#d0bfff" },
      { e: ["\u{1F98E}"], c1: "#087f5b", c2: "#96f2d7" },
      { e: ["\u{1F338}"], c1: "#f06595", c2: "#ffdeeb" },
      { e: ["\u26F5"], c1: "#1971c2", c2: "#a5d8ff" },
      { e: ["\u{1F351}"], c1: "#f76707", c2: "#ffd8a8" },
      { e: ["\u{1F38B}"], c1: "#2f9e44", c2: "#b2f2bb" },
      { e: ["\u{1F302}"], c1: "#9c36b5", c2: "#eebefa" },
      { e: ["\u{1F420}"], c1: "#0c8599", c2: "#66d9e8" },
      { e: ["\u{1F352}"], c1: "#a61e4d", c2: "#ff8fab" },
      { e: ["\u{1F33D}"], c1: "#e67700", c2: "#ffec99" },
      { e: ["\u{1F419}"], c1: "#4263eb", c2: "#bac8ff" },
      { e: ["\u{1F340}"], c1: "#37b24d", c2: "#d3f9d8" },
      { e: ["\u{1F3AD}"], c1: "#845ef7", c2: "#e5dbff" },
      { e: ["\u{1FAB6}"], c1: "#748ffc", c2: "#dbe4ff" },
      { e: ["\u{1F387}"], c1: "#f59f00", c2: "#fff3bf" },
      { e: ["\u{1F965}"], c1: "#7f5539", c2: "#ddb892" },
      { e: ["\u{1F42C}"], c1: "#1098ad", c2: "#c5f6fa" },
      { e: ["\u{1F33A}"], c1: "#e03131", c2: "#ffc9c9" },
      { e: ["\u{1F334}"], c1: "#099268", c2: "#a9f1cf" },
      { e: ["\u{1F3B7}"], c1: "#ca8a04", c2: "#fde68a" },
      { e: ["\u{1F41E}"], c1: "#c0392b", c2: "#f5b7b1" },
      { e: ["\u{1FA84}"], c1: "#7048e8", c2: "#c5b3f5" },
      { e: ["\u{1F34B}"], c1: "#fab005", c2: "#fff9db" },
      { e: ["\u{1F407}"], c1: "#868e96", c2: "#f1f3f5" },
      { e: ["\u{1F307}"], c1: "#e8632c", c2: "#fcc419" },
      { e: ["\u{1F9AD}"], c1: "#4c6ef5", c2: "#bac8ff" }
    ];
    COMBINING = new RegExp(`[${String.fromCharCode(768)}-${String.fromCharCode(879)}]`, "g");
    SUFFIXES2 = ["ness", "ful", "ing", "ed", "es", "ly", "s"];
    FEEL_INDEX = /* @__PURE__ */ new Map();
    {
      const put = (k, e) => {
        if (k && !FEEL_INDEX.has(k)) FEEL_INDEX.set(k, e);
      };
      for (const [k, e] of Object.entries(LEXICON)) {
        put(k, e);
        put(stem2(k), e);
      }
      for (const [w, k] of Object.entries(SYNONYMS)) {
        const e = LEXICON[k];
        if (e) {
          put(normalize2(w), e);
          put(stem2(normalize2(w)), e);
        }
      }
    }
    VS16 = String.fromCharCode(65039);
    bare = (e) => e.split(VS16).join("");
  }
});

// src/study/themeLibrary.ts
function feelFor(name, custom2) {
  const uniq = [...new Set(custom2.map((t) => t.name.toLowerCase()).filter((n) => !BY_NAME.has(n)))].sort();
  const key = uniq.join("\0");
  if (key !== feelKey) {
    feelKey = key;
    feelCache = /* @__PURE__ */ new Map();
    const taken2 = new Set(PREMADE_EMOJI);
    for (const n of uniq) {
      const f = feelSpec(n, taken2);
      taken2.add(f.emoji);
      feelCache.set(n, f);
    }
  }
  const hit = feelCache.get(name.toLowerCase());
  if (hit) return hit;
  const taken = new Set(PREMADE_EMOJI);
  for (const f of feelCache.values()) taken.add(f.emoji);
  return feelSpec(name, taken);
}
function themeSpec(name, custom2 = [], colorHex = {}) {
  const hit = BY_NAME.get(name.toLowerCase());
  if (hit) return hit;
  const feel = feelFor(name, custom2);
  const user = custom2.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (user) {
    const hex = colorHex[user.color] ?? user.color ?? "#e8c547";
    const picked = !DEFAULT_YELLOWS.has(hex.toLowerCase());
    return {
      name: user.name,
      emoji: feel.emoji,
      c1: picked ? hex : feel.c1,
      c2: feel.c2
    };
  }
  return { name, emoji: feel.emoji, c1: feel.c1, c2: feel.c2 };
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
var THEME_LIBRARY, BY_NAME, PREMADE_EMOJI, DEFAULT_YELLOWS, feelKey, feelCache;
var init_themeLibrary = __esm({
  "src/study/themeLibrary.ts"() {
    "use strict";
    init_tagFeel();
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
    PREMADE_EMOJI = THEME_LIBRARY.map((t) => t.emoji);
    DEFAULT_YELLOWS = /* @__PURE__ */ new Set(["#e8c547", "#f5d90a"]);
    feelKey = "";
    feelCache = /* @__PURE__ */ new Map();
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
var import_obsidian7, COLORS, COLOR_HEX, MARK_BG, NoteModal, AnnotationService, NotesPopover;
var init_annotations = __esm({
  "src/social/annotations.ts"() {
    "use strict";
    import_obsidian7 = require("obsidian");
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
    NoteModal = class extends import_obsidian7.Modal {
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
        const menu = new import_obsidian7.Menu();
        menu.addItem((i) => i.setTitle("\u{1F512} Only me (this device)").onClick(() => onPick("local", null, "Only me \u2014 this device")));
        menu.addItem((i) => i.setTitle("\u{1F510} Only me (synced)").onClick(() => onPick("private", null, "Only me")));
        for (const g of this.s.groups) {
          menu.addItem((i) => i.setTitle(`\u{1F465} ${g.name}`).onClick(() => onPick("group", g.group_id, g.name)));
        }
        menu.addItem((i) => i.setTitle("\u{1F30E} Public (everyone in Scripture Graph)").onClick(() => onPick("public", null, "Public")));
        return menu;
      }
    };
    NotesPopover = class extends import_obsidian7.Modal {
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
              new import_obsidian7.Notice(`Now visible to: ${label}`);
              this.close();
            }).showAtMouseEvent(e);
          };
          const del = actions.createEl("button", { text: "Delete" });
          del.onclick = async () => {
            del.setAttribute("disabled", "true");
            del.setText("Deleting\u2026");
            try {
              await this.svc.remove(a.annotation_id);
              new import_obsidian7.Notice("Deleted");
            } catch (e) {
              new import_obsidian7.Notice(`Delete failed: ${e.message}`);
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

// src/study/presence.ts
var presence_exports = {};
__export(presence_exports, {
  CHAPTER_VOICES: () => CHAPTER_VOICES,
  SCENE_OVERRIDES: () => SCENE_OVERRIDES,
  VOICES: () => VOICES,
  matchScene: () => matchScene,
  voiceFor: () => voiceFor
});
function voiceFor(slug) {
  const dash = slug.lastIndexOf("-");
  const book = dash > 0 ? slug.slice(0, dash) : slug;
  const v = VOICES[book];
  if (!v) return null;
  const over = CHAPTER_VOICES[slug];
  return { v: { ...v, ...over }, chapterLine: over?.line ?? null };
}
function matchScene(chapterText, slug) {
  if (slug) {
    if (SCENE_OVERRIDES[slug]) return SCENE_OVERRIDES[slug];
    const dash = slug.lastIndexOf("-");
    const book = dash > 0 ? slug.slice(0, dash) : slug;
    if (SCENE_OVERRIDES[book]) return SCENE_OVERRIDES[book];
  }
  let best = "sunrise";
  let bestScore = 0;
  for (const [scene, re] of SCENE_KEYWORDS) {
    const score = (chapterText.match(re) ?? []).length;
    if (score > bestScore) {
      bestScore = score;
      best = scene;
    }
  }
  return best;
}
var VOICES, CHAPTER_VOICES, SCENE_KEYWORDS, SCENE_OVERRIDES;
var init_presence = __esm({
  "src/study/presence.ts"() {
    "use strict";
    VOICES = {
      gen: { author: "Moses", place: "the wilderness of Sinai", era: "recounting the beginning", line: "the record of creation, the fall, and the covenant family" },
      ex: { author: "Moses", place: "the wilderness", era: "after the deliverance from Egypt", line: "written by the man who stood before Pharaoh and the burning bush" },
      lev: { author: "Moses", place: "the foot of Sinai", era: "the first year of the Exodus", line: "the law given while the tabernacle was new" },
      num: { author: "Moses", place: "the wilderness", era: "forty years of wandering", line: "a people counted, tested, and led" },
      deut: { author: "Moses", place: "the plains of Moab", era: "his final days", line: "an old prophet's last sermons, in sight of a land he will not enter" },
      josh: { author: "Joshua", place: "Canaan", era: "the conquest and settlement", line: "the soldier who served Moses now leads" },
      judg: { author: "Samuel", display: "the chronicler (trad. Samuel)", place: "Israel", era: "the turbulent generations before the kings", line: "when every man did what was right in his own eyes" },
      ruth: { author: "Samuel", display: "the chronicler", place: "Bethlehem", era: "the days of the judges", line: "a quiet story of loyalty inside a violent age" },
      "1sam": { author: "Samuel", place: "Israel", era: "the birth of the monarchy", line: "prophet, kingmaker, and mourner of kings" },
      "2sam": { author: "Samuel", display: "the court chronicler", place: "Jerusalem", era: "David's reign", line: "the glory and the wreckage of a king after God's own heart" },
      "1kgs": { author: "Jeremiah", display: "the chronicler (trad. Jeremiah)", place: "Jerusalem", era: "from Solomon to the divided kingdom", line: "how wisdom rose and the kingdom tore" },
      "2kgs": { author: "Jeremiah", display: "the chronicler", place: "Jerusalem", era: "the fall of two kingdoms", line: "prophets crying to kings who would not hear" },
      "1chr": { author: "Ezra", display: "the chronicler (trad. Ezra)", place: "Jerusalem, rebuilt", era: "after the exile", line: "a returned people retelling their story to remember who they are" },
      "2chr": { author: "Ezra", display: "the chronicler", place: "Jerusalem, rebuilt", era: "after the exile", line: "the temple's story, told by those who lost it and came home" },
      ezra: { author: "Ezra", place: "Jerusalem", era: "the return from Babylon", line: "a scribe rebuilding a people around the word" },
      neh: { author: "Nehemiah", place: "Jerusalem's broken walls", era: "~445 BC", line: "a cupbearer who left a palace to rebuild a ruin" },
      esth: { author: "Mordecai", display: "the chronicler", place: "Susa, Persia", era: "the exile", line: "courage in a court where God is never named and always present" },
      job: { author: "Job", display: "unknown poet", place: "the land of Uz", era: "the age of the patriarchs", line: "the oldest questions, asked from the ash heap" },
      ps: { author: "David", display: "David and the temple poets", place: "wilderness caves and the sanctuary", era: "across centuries", line: "prayers that were sung \u2014 grief, awe, and trust set to music" },
      prov: { author: "Solomon", place: "the court of Jerusalem", era: "the golden age", line: "a father's wisdom pressed into sayings" },
      eccl: { author: "Solomon", display: "the Preacher", place: "Jerusalem", era: "the end of a full life", line: "everything tried, everything weighed" },
      song: { author: "Solomon", place: "Jerusalem", era: "the golden age", line: "love poetry the ages kept" },
      isa: { author: "Isaiah", place: "Jerusalem", era: "~740\u2013690 BC, under four kings", line: "the prophet of the temple vision, walking with kings and seeing the Messiah" },
      jer: { author: "Jeremiah", place: "Jerusalem under siege", era: "the last years before Babylon", line: "the weeping prophet, hated for telling the truth" },
      lam: { author: "Jeremiah", place: "the ruins of Jerusalem", era: "586 BC", line: "funeral poetry for a city he loved and warned" },
      ezek: { author: "Ezekiel", place: "by the river Chebar, Babylon", era: "the exile", line: "a priest with no temple, seeing visions instead" },
      dan: { author: "Daniel", place: "the courts of Babylon and Persia", era: "the exile", line: "faithful in a foreign palace, from youth to old age" },
      hosea: { author: "Hosea", place: "the northern kingdom", era: "its final decades", line: "a broken marriage lived as prophecy" },
      joel: { author: "Joel", place: "Judah", era: "after the locusts", line: "disaster read as a summons to return" },
      amos: { author: "Amos", place: "Bethel", era: "~760 BC", line: "a shepherd from the south thundering at northern comfort" },
      obad: { author: "Obadiah", place: "Judah", era: "after Jerusalem's fall", line: "the shortest book: a brother's betrayal answered" },
      jonah: { author: "Jonah", place: "Nineveh, unwillingly", era: "~780 BC", line: "the prophet who ran, and the mercy that wouldn't" },
      micah: { author: "Micah", place: "the villages of Judah", era: "Isaiah's generation", line: "what does the Lord require of thee?" },
      nahum: { author: "Nahum", place: "Judah", era: "before Nineveh fell", line: "the end of the empire that terrorized his world" },
      hab: { author: "Habakkuk", place: "the watchtower", era: "before Babylon came", line: "arguing with God, and choosing trust" },
      zeph: { author: "Zephaniah", place: "Jerusalem", era: "Josiah's reforms", line: "a royal descendant announcing the day of the Lord" },
      hag: { author: "Haggai", place: "Jerusalem", era: "520 BC", line: "urging a discouraged people to build again" },
      zech: { author: "Zechariah", place: "Jerusalem", era: "the temple rebuilding", line: "visions in the night for a small, struggling remnant" },
      mal: { author: "Malachi", place: "Jerusalem", era: "the Old Testament's last word", line: "the last prophet before four hundred years of silence" },
      matt: { author: "Matthew", place: "written for Israel", era: "~AD 60s", line: "the tax collector Jesus called from the receipt table" },
      mark: { author: "Mark", place: "Rome", era: "~AD 60s", line: "Peter's memories, written fast and urgent" },
      luke: { author: "Luke", place: "compiled from eyewitnesses", era: "~AD 60s", line: "a physician's careful investigation, for one honest reader" },
      john: { author: "John", place: "Ephesus", era: "old age, ~AD 90s", line: "the disciple Jesus loved, distilling a lifetime" },
      acts: { author: "Luke", place: "on the roads of the empire", era: "~AD 62", line: "volume two: the church catches fire and spreads" },
      rom: { author: "Paul", place: "Corinth", era: "~AD 57", line: "his fullest gospel, sent ahead to a city he'd never seen" },
      "1cor": { author: "Paul", place: "Ephesus", era: "~AD 55", line: "a founder writing to his fractured, gifted church" },
      "2cor": { author: "Paul", place: "Macedonia", era: "~AD 56", line: "his most personal letter \u2014 strength out of weakness" },
      gal: { author: "Paul", place: "on the road", era: "~AD 49", line: "written hot, in his own large letters" },
      eph: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "chained, and writing about the church as the body of Christ" },
      philip: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "joy, from a man in chains" },
      col: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "to a church he never met, about the supremacy of Christ" },
      "1thes": { author: "Paul", place: "Corinth", era: "~AD 51 \u2014 likely his earliest letter", line: "to brand-new believers he was torn from too soon" },
      "2thes": { author: "Paul", place: "Corinth", era: "~AD 51", line: "steadying a church shaken about the Lord's return" },
      "1tim": { author: "Paul", place: "Macedonia", era: "~AD 64", line: "a father in the faith coaching his young successor" },
      "2tim": { author: "Paul", place: "a Roman dungeon", era: "~AD 66, awaiting execution", line: "his last surviving words: I have kept the faith" },
      titus: { author: "Paul", place: "en route", era: "~AD 64", line: "order for the rough young churches of Crete" },
      philem: { author: "Paul", place: "a Roman prison", era: "~AD 62", line: "one page that quietly dismantles slavery with love" },
      heb: { author: "Paul", display: "unknown (trad. Paul)", place: "outside the land", era: "before AD 70", line: "to wavering Jewish believers: Christ is greater" },
      james: { author: "James", place: "Jerusalem", era: "~AD 45", line: "the Lord's brother, blunt as a proverb" },
      "1pet": { author: "Peter", place: "Rome ('Babylon')", era: "~AD 64, as persecution began", line: "the fisherman steadying scattered exiles" },
      "2pet": { author: "Peter", place: "Rome", era: "shortly before his death", line: "a shepherd's farewell warnings" },
      "1jn": { author: "John", place: "Ephesus", era: "old age", line: "little children, love one another" },
      "2jn": { author: "John", place: "Ephesus", era: "old age", line: "a postcard: truth and love, walk in them" },
      "3jn": { author: "John", place: "Ephesus", era: "old age", line: "the smallest book \u2014 hospitality and truth" },
      jude: { author: "Jude", place: "Judea", era: "~AD 65", line: "the Lord's brother, contending for the faith" },
      rev: { author: "John", place: "exiled on Patmos", era: "~AD 95", line: "a prisoner's window opened onto the end of the story" },
      "1ne": { author: "Nephi", place: "the wilderness, the sea, a new land", era: "~600\u2013570 BC", line: "a young man engraving his family's escape from Jerusalem" },
      "2ne": { author: "Nephi", place: "the land of Nephi", era: "his later years", line: "an aging founder writing for his people \u2014 and for us" },
      jacob: { author: "Jacob", place: "the temple in the land of Nephi", era: "the second generation", line: "born in the wilderness, anxious for his people's souls" },
      enos: { author: "Enos", place: "the forests, hunting", era: "the third generation", line: "one man's all-day wrestle before God" },
      jarom: { author: "Jarom", place: "the land of Nephi", era: "keeping the record", line: "a small entry in the small plates" },
      omni: { author: "Omni", display: "Omni and four record-keepers", place: "the land of Nephi to Zarahemla", era: "generations passing the plates", line: "five voices bridging two worlds" },
      wofm: { author: "Mormon", place: "amid the final wars", era: "~AD 385", line: "the editor steps forward to explain the records" },
      mosiah: { author: "Mormon", place: "abridging in the last days of his people", era: "events ~130\u201391 BC", line: "kings, prophets, and a people in bondage delivered" },
      alma: { author: "Mormon", place: "abridging the great records", era: "events ~91\u201352 BC", line: "the longest book: missions, wars, and the wrestle for souls" },
      hel: { author: "Mormon", place: "abridging as his nation dies", era: "events ~52\u20131 BC", line: "pride cycles quickening toward the sign" },
      "3ne": { author: "Mormon", place: "abridging the most sacred record", era: "events ~AD 1\u201335", line: "darkness, then the risen Christ among them" },
      "4ne": { author: "Mormon", place: "abridging two golden centuries", era: "events ~AD 36\u2013321", line: "what a whole people at peace looks like \u2014 and how it ends" },
      morm: { author: "Mormon", place: "the last battlefields", era: "~AD 385", line: "a general who never stopped loving the people he buried" },
      ether: { author: "Moroni", place: "alone, wandering", era: "after his people's fall", line: "abridging an older fallen nation while his own lies in ruins" },
      moro: { author: "Moroni", place: "alone, hunted", era: "~AD 400\u2013421", line: "the last Nephite, sealing the record for you" },
      dc: { author: "Joseph Smith", place: "Kirtland, Missouri, Nauvoo \u2014 as given", era: "1823\u20131847", line: "revelations received in the moment, place by place" },
      od: { author: "Joseph Smith", display: "the Presidents of the Church", place: "Salt Lake City", era: "1890 and 1978", line: "official declarations to the whole church" },
      moses: { author: "Moses", display: "revealed to Joseph Smith", place: "given June\u2013Dec 1830", era: "restoring Moses' vision", line: "what Moses saw, restored" },
      abr: { author: "Abraham", display: "translated by Joseph Smith", place: "from Egyptian papyri, 1835\u201342", era: "Abraham in Egypt", line: "the father of the faithful, in his own record" },
      jsm: { author: "Joseph Smith", place: "Kirtland, 1831", era: "revising Matthew 24", line: "the Olivet discourse, clarified" },
      jsh: { author: "Joseph Smith", place: "Nauvoo, 1838", era: "telling his own story", line: "a young man's grove, in his own words" },
      aoff: { author: "Joseph Smith", place: "Nauvoo, 1842", era: "the Wentworth letter", line: "thirteen sentences of what we believe" }
    };
    CHAPTER_VOICES = {
      "alma-36": { line: "an old father giving his conversion to his son Helaman \u2014 shaped as one great chiasm" },
      "alma-37": { line: "entrusting the records to Helaman: by small and simple things" },
      "alma-38": { line: "to Shiblon, the steady son" },
      "alma-39": { line: "to Corianton, the wandering son \u2014 hard love" },
      "2ne-4": { line: "Nephi's psalm: grief and grace in the same breath" },
      "3ne-11": { line: "the moment: a voice from heaven, and He descends" },
      "ps-23": { line: "the shepherd psalm, from a man who kept sheep" },
      "ps-51": { line: "David after Nathan's finger pointed at him" },
      "isa-53": { line: "the suffering servant, seen seven centuries early" },
      "john-17": { line: "overhearing the Son pray to the Father" },
      "luke-15": { line: "three lost things, one seeking heart" },
      "matt-5": { line: "on the mountainside \u2014 the kingdom's constitution" },
      "gen-22": { line: "the hardest walk a father ever took" },
      "ex-3": { line: "a shepherd, a bush that burns, a name revealed" },
      "1ne-3": { line: "I will go and do \u2014 a young man's resolve" },
      "jsh-1": { line: "a fourteen-year-old walks into a grove" },
      "dc-121": { line: "from the pit of Liberty Jail: O God, where art thou?" },
      "dc-76": { line: "the vision of the three glories, seen with Sidney Rigdon" },
      "morm-6": { line: "a father watching his whole world fall at Cumorah" },
      "moro-10": { line: "the last page: a promise, and a farewell until the bar of God" }
    };
    SCENE_KEYWORDS = [
      ["warcamp", /\b(armies|army|battle|wars?|swords?|shields?|banners?|standard of|captains?|soldiers?|fight|slay|slain|smite|smitten|warriors?|chariots?|siege|fortif(y|ied|ications?)|encamp|spears?|title of liberty)/gi],
      ["prison", /\b(prison(er|s)?|dungeon|chains?|jail|bound with|bonds|fetters|captive|cell|deliver(ed)? out of|liberty jail)/gi],
      ["storm", /\b(storm|tempest|whirlwind|thunder|lightning|billows?|tossed|waves)/gi],
      ["mount", /\b(mount(ain)?s?|sinai|horeb|hill of|high place|transfigur|summit)/gi],
      ["temple", /\b(temple|tabernacle|altar|sanctuary|holy place|priest|offering|veil)/gi],
      ["garden", /\b(garden|tree of|vineyard|olive|branch(es)?|fruit|eden|gethsemane|vine)/gi],
      ["fields", /\b(fields?|harvest|wheat|reap|sow(er|ed|eth)?|barley|glean|sickle|tares)/gi],
      ["city", /\b(city|jerusalem|walls?|gates?|streets?|zion|babylon|towers?)/gi],
      ["waters", /\b(waters?|sea|river|rain|fountain|deep|ship|flood|fish|baptiz)/gi],
      ["desert", /\b(wilderness|desert|sand|camel|thirst|dry|waste|journey)/gi],
      ["starlight", /\b(stars?|heavens?|night|moon|firmament|host of|sky|glory)/gi],
      ["sunrise", /\b(morning|dawn|sunris|light|day ?spring|east|arise|awake)/gi],
      ["candle", /\b(candle|lamp|oil|watch|evening|supper|upper room|vigil)/gi]
    ];
    SCENE_OVERRIDES = {
      // chapters — landmark moments land in their own world
      "ps-23": "waters",
      "gen-1": "starlight",
      "gen-2": "garden",
      "gen-3": "garden",
      "ex-3": "desert",
      "ex-14": "waters",
      "ex-19": "mount",
      "ex-20": "mount",
      "matt-2": "starlight",
      "matt-5": "mount",
      "matt-6": "mount",
      "matt-7": "mount",
      "matt-8": "storm",
      "matt-13": "fields",
      "matt-26": "garden",
      "matt-27": "city",
      "mark-4": "storm",
      "john-13": "candle",
      "john-15": "garden",
      "john-17": "candle",
      "luke-2": "starlight",
      "luke-8": "storm",
      "luke-15": "fields",
      "luke-22": "garden",
      "acts-27": "storm",
      "1kgs-19": "mount",
      "1kgs-8": "temple",
      "2chr-6": "temple",
      "isa-6": "temple",
      "ps-122": "city",
      "ps-127": "city",
      "ps-84": "temple",
      "neh-2": "city",
      "neh-4": "city",
      "jonah-1": "storm",
      "jonah-2": "waters",
      "3ne-1": "starlight",
      "3ne-12": "temple",
      "3ne-13": "temple",
      "3ne-14": "temple",
      "1ne-18": "storm",
      "ether-2": "mount",
      "ether-3": "mount",
      "ether-6": "storm",
      "hel-14": "city",
      "hel-16": "city",
      "alma-32": "fields",
      "alma-36": "sunrise",
      "mosiah-2": "temple",
      "jsh-1": "sunrise",
      // ⚔️ the war chapters — the whole Alma war block and the canon's battles
      "alma-2": "warcamp",
      "alma-43": "warcamp",
      "alma-44": "warcamp",
      "alma-45": "warcamp",
      "alma-46": "warcamp",
      "alma-47": "warcamp",
      "alma-48": "warcamp",
      "alma-49": "warcamp",
      "alma-50": "warcamp",
      "alma-51": "warcamp",
      "alma-52": "warcamp",
      "alma-53": "warcamp",
      "alma-54": "warcamp",
      "alma-55": "warcamp",
      "alma-56": "warcamp",
      "alma-57": "warcamp",
      "alma-58": "warcamp",
      "alma-59": "warcamp",
      "alma-60": "warcamp",
      "alma-61": "warcamp",
      "alma-62": "warcamp",
      "1sam-17": "warcamp",
      "2kgs-6": "warcamp",
      "josh-6": "warcamp",
      "josh-8": "warcamp",
      "josh-10": "warcamp",
      "josh-3": "waters",
      "josh-4": "waters",
      "3ne-3": "warcamp",
      "3ne-4": "warcamp",
      "ether-13": "warcamp",
      "ether-14": "warcamp",
      "ether-15": "warcamp",
      "hel-1": "warcamp",
      "morm-8": "candle",
      "morm-9": "candle",
      // ⛓️ the prison chapters — captivity, and the light that gets in
      "gen-39": "prison",
      "gen-40": "prison",
      "jer-37": "prison",
      "jer-38": "prison",
      "dan-3": "prison",
      "dan-6": "prison",
      "acts-12": "prison",
      "acts-16": "prison",
      "alma-14": "prison",
      "hel-5": "prison",
      "mosiah-21": "prison",
      "mosiah-24": "prison",
      "ps-142": "prison",
      "dc-121": "prison",
      "dc-122": "prison",
      "dc-123": "prison",
      // whole books
      "2tim": "candle",
      "eph": "candle",
      "philip": "candle",
      "col": "candle",
      "philem": "candle",
      "rev": "starlight",
      "abr": "starlight",
      "ex": "desert",
      "num": "desert",
      "deut": "desert",
      "ruth": "fields",
      "song": "garden",
      "lam": "city",
      "neh": "city",
      "hag": "temple",
      "lev": "temple",
      "josh": "warcamp",
      "judg": "warcamp",
      "morm": "warcamp"
    };
  }
});

// src/study/translations.ts
function isBiblical(verseId) {
  const r = parseVerseId(verseId);
  const b = r ? BOOK_BY_SLUG.get(r.bookSlug) : void 0;
  return !!b && (b.volume === "Old Testament" || b.volume === "New Testament");
}
async function bookText(app, bookName, abbr) {
  const dest = app.metadataCache.getFirstLinkpathDest(`${bookName} (${abbr})`, "");
  if (!(dest instanceof import_obsidian9.TFile)) return null;
  const hit = fileCache.get(dest.path);
  if (hit != null) return hit;
  const text = await app.vault.cachedRead(dest);
  if (fileCache.size >= 8) fileCache.clear();
  fileCache.set(dest.path, text);
  return text;
}
async function translationVerse(app, verseId, abbr) {
  const r = parseVerseId(verseId);
  if (!r) return null;
  const b = BOOK_BY_SLUG.get(r.bookSlug);
  if (!b) return null;
  const text = await bookText(app, b.name, abbr);
  if (!text) return null;
  const m = new RegExp(`^\\*\\*${r.chapter}:${r.verse}\\*\\*\\s+(.*)$`, "m").exec(text);
  return m?.[1]?.trim() || null;
}
var import_obsidian9, TRANSLATIONS, fileCache, TranslationsModal;
var init_translations = __esm({
  "src/study/translations.ts"() {
    "use strict";
    import_obsidian9 = require("obsidian");
    init_src();
    TRANSLATIONS = [
      { abbr: "KJV", name: "King James Version", note: "your reading text" },
      { abbr: "WEB", name: "World English Bible", note: "modern English \xB7 public domain" },
      { abbr: "ASV", name: "American Standard Version", note: "1901 \xB7 public domain" },
      { abbr: "YLT", name: "Young's Literal Translation", note: "literal \xB7 public domain" }
    ];
    fileCache = /* @__PURE__ */ new Map();
    TranslationsModal = class extends import_obsidian9.Modal {
      constructor(s, verseId, kjvText) {
        super(s.app);
        this.s = s;
        this.verseId = verseId;
        this.kjvText = kjvText;
      }
      onOpen() {
        this.modalEl.addClass("sg-trans-modal");
        const c = this.contentEl;
        c.addClass("sg-trans");
        c.createEl("h3", {
          cls: "sg-trans-title",
          text: `\u{1F310} ${verseDisplay(this.verseId) ?? this.verseId}`
        });
        const list = c.createDiv({ cls: "sg-trans-list" });
        for (const t of TRANSLATIONS) {
          const row = list.createDiv({ cls: "sg-trans-row" });
          if (t.abbr === "KJV") row.addClass("sg-trans-kjv");
          const head = row.createDiv({ cls: "sg-trans-head" });
          head.createSpan({ cls: "sg-trans-abbr", text: t.abbr });
          head.createSpan({ cls: "sg-trans-name", text: `${t.name} \xB7 ${t.note}` });
          const body = row.createDiv({
            cls: "sg-trans-text",
            text: t.abbr === "KJV" ? this.kjvText : "\u2026"
          });
          if (t.abbr !== "KJV") {
            void translationVerse(this.s.app, this.verseId, t.abbr).then((v) => {
              if (v) {
                body.setText(v);
                return;
              }
              body.setText("not available \u2014 this translation may still be syncing to this device");
              body.addClass("sg-trans-missing");
            });
          }
        }
        c.createDiv({
          cls: "sg-trans-foot",
          text: "WEB, ASV, and YLT are public domain and stored in your own library \u2014 they work offline."
        });
      }
      onClose() {
        this.contentEl.empty();
      }
    };
  }
});

// src/study/studyBar.ts
var studyBar_exports = {};
__export(studyBar_exports, {
  StudyBar: () => StudyBar,
  openLocalGraphFor: () => openLocalGraphFor
});
async function openLocalGraphFor(s, linkText) {
  if (!linkText) return void new import_obsidian10.Notice("Nothing to graph here yet");
  const f = s.app.metadataCache.getFirstLinkpathDest(linkText, "");
  if (!f) return void new import_obsidian10.Notice(`Can't find \u201C${linkText}\u201D`);
  const ws = s.app.workspace;
  const returnLeaf = ws.getMostRecentLeaf?.() ?? null;
  const leaf = ws.getLeaf(import_obsidian10.Platform.isMobile ? "tab" : "split");
  const GRAPH_OPTS = {
    textFadeMultiplier: 3,
    nodeSizeMultiplier: 1.4,
    lineSizeMultiplier: 1,
    showArrow: false,
    localJumps: 1,
    localBacklinks: true,
    localForelinks: true,
    localInterlinks: true,
    showTags: false,
    showAttachments: false,
    hideUnresolved: true,
    // label fading is ZOOM-dependent (verified in Obsidian's source: the
    // engine honors options.scale via renderer.zoomTo) — a sane initial zoom
    // is what actually makes labels readable, fade multiplier alone is not
    scale: 1,
    // settings panel arrives CLOSED and its sections collapsed
    close: true,
    "collapse-filter": true,
    "collapse-color-groups": true,
    "collapse-display": true,
    "collapse-forces": true
  };
  await leaf.setViewState({
    type: "localgraph",
    active: true,
    state: { file: f.path, options: GRAPH_OPTS }
  });
  await ws.revealLeaf(leaf);
  const pushOptions = () => {
    const view = leaf.view;
    const engine = view?.engine ?? view?.dataEngine;
    if (engine?.setOptions) {
      engine.setOptions(GRAPH_OPTS);
      const applied = engine.getOptions?.() ?? {};
      trace("graph.applied", {
        tf: applied["textFadeMultiplier"],
        scale: applied["scale"],
        nodes: applied["nodeSizeMultiplier"]
      });
      return true;
    }
    return false;
  };
  if (!pushOptions()) {
    window.setTimeout(pushOptions, 250);
    window.setTimeout(pushOptions, 800);
    window.setTimeout(pushOptions, 1800);
  }
  if (import_obsidian10.Platform.isMobile && returnLeaf) {
    const container = leaf.view?.containerEl;
    if (container) {
      const back = container.createDiv({ cls: "sg-graph-back", text: `\u2190 ${linkText}` });
      back.onclick = () => {
        leaf.detach?.();
        ws.setActiveLeaf?.(returnLeaf, { focus: true });
      };
    }
  }
  trace("graph.open", { file: f.path });
}
var import_obsidian10, SCOPE_LABEL, StudyBar, ThemeNameModal;
var init_studyBar = __esm({
  "src/study/studyBar.ts"() {
    "use strict";
    import_obsidian10 = require("obsidian");
    init_src();
    init_annotations();
    init_themeLibrary();
    init_trace();
    init_translations();
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
            if (!import_obsidian10.Platform.isMobile) return;
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
        if (!import_obsidian10.Platform.isMobile) {
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
      /** chip selection visuals are inline — immune to any CSS cascade surprise */
      paintChip(el, on) {
        const chip = el.querySelector("strong");
        if (!chip) return;
        if (on) {
          chip.style.background = "var(--interactive-accent)";
          chip.style.color = "var(--text-on-accent)";
          chip.style.borderColor = "transparent";
        } else {
          chip.style.background = "";
          chip.style.color = "";
          chip.style.borderColor = "";
        }
      }
      toggleVerse(verseId, el) {
        trace("verse.toggle", { verseId });
        this.sel.partial = null;
        const i = this.sel.verses.findIndex((v) => v.verseId === verseId);
        if (i >= 0) {
          this.sel.verses[i].el.removeClass("sg-vsel");
          this.paintChip(this.sel.verses[i].el, false);
          this.sel.verses.splice(i, 1);
        } else {
          el.addClass("sg-vsel");
          this.paintChip(el, true);
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
        for (const v of this.sel.verses) {
          v.el.removeClass("sg-vsel");
          this.paintChip(v.el, false);
        }
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
          this.s.device.barExpanded,
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
        const expanded = this.s.device.barExpanded;
        const disclose = bar.createEl("button", { cls: "sg-bar-disclose" });
        disclose.createSpan({ text: "Styles & themes" });
        disclose.createSpan({ cls: "sg-bar-disclose-chev", text: expanded ? "\u2304" : "\u203A" });
        disclose.onclick = () => {
          this.s.device.barExpanded = !expanded;
          void this.s.saveDevice();
          this.render();
        };
        if (expanded) {
          const styleRow = bar.createDiv({ cls: "sg-studybar-styles" });
          const styles = [
            ["highlight", "\u{1F58D}"],
            ["underline", "U\u0332"],
            ["bold", "B"],
            ["italic", "I"]
          ];
          for (const [key, label] of styles) {
            const chip = styleRow.createEl("button", { cls: "sg-style-chip", text: label });
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
            chip.style.borderBottom = `2px solid ${sp.c1}`;
            chipByName.set(sp.name.toLowerCase(), chip);
            chip.onclick = () => void this.doTheme(sp);
          }
          const add = trow.createEl("button", { cls: "sg-theme-chip sg-theme-add", text: "\uFF0B own" });
          add.onclick = () => this.saveThemePrompt();
          void this.markActiveThemeChips(chipByName);
        }
        const row = bar.createDiv({ cls: "sg-studybar-actions" });
        const act = (label, fn) => {
          const b = row.createEl("button", { text: label });
          b.onclick = fn;
        };
        act("\u{1F4DD} Note", () => this.doNote());
        act("\u{1F0CF} Card", () => void this.doFlashcard());
        const firstSel = this.sel.partial ?? this.sel.verses[0] ?? null;
        if (firstSel && isBiblical(firstSel.verseId)) {
          act("\u{1F310} Versions", () => {
            new TranslationsModal(this.s, firstSel.verseId, firstSel.verseText).open();
          });
        }
        const more = row.createEl("button", { cls: "sg-act-more", text: "\u22EF" });
        more.setAttribute("aria-label", "More actions");
        more.onclick = (e) => {
          const menu = new import_obsidian10.Menu();
          menu.addItem((i) => i.setTitle("\u{1F578} Connections graph").onClick(() => void this.openGraph()));
          menu.addItem((i) => i.setTitle("\u{1F4CB} Copy verse").onClick(() => void this.doCopy()));
          menu.addItem((i) => i.setTitle("\u2728 Ask AI").onClick(() => this.doAsk()));
          menu.showAtMouseEvent(e);
        };
      }
      pickScope(e) {
        const menu = new import_obsidian10.Menu();
        const set = (visibility, groupId, label) => {
          this.s.device.lastShareScope = { visibility, groupId };
          void this.s.saveDevice();
          new import_obsidian10.Notice(`New marks: ${label}`);
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
        new import_obsidian10.Notice(`Marked ${this.refLabel()}`);
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
        new import_obsidian10.Notice(added && !removed ? `${spec.emoji} ${spec.name} \u2014 ${this.refLabel()}` : !added && removed ? `${spec.emoji} ${spec.name} removed` : `${spec.emoji} ${spec.name} updated`);
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
          new import_obsidian10.Notice(`Theme \u201C${name}\u201D added to the family library`);
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
          new import_obsidian10.Notice(`Note saved \u2014 ${ref}`);
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
          new import_obsidian10.Notice(`Copied ${ref}`);
        } catch {
          new import_obsidian10.Notice("Copy failed");
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
    ThemeNameModal = class extends import_obsidian10.Modal {
      constructor(s, desc, onSave) {
        super(s.app);
        this.s = s;
        this.desc = desc;
        this.onSave = onSave;
      }
      onOpen() {
        this.contentEl.createEl("h3", { text: "Name this theme" });
        this.contentEl.createEl("p", {
          text: `Current look: ${this.desc}. Themes are shared with the family \u2014 e.g. "Faith", "Covenants", "Promises".`
        });
        let name = "";
        const prev = this.contentEl.createDiv();
        prev.style.cssText = "display:flex;align-items:center;gap:8px;min-height:24px;margin:2px 0 6px;";
        const badge = prev.createSpan();
        badge.style.fontSize = "1.3em";
        const swatch = prev.createSpan();
        swatch.style.cssText = "flex:1;height:10px;border-radius:5px;";
        const preview = (v) => {
          const n = v.trim();
          if (!n) {
            badge.setText("");
            swatch.style.background = "none";
            return;
          }
          const sim = [
            ...(this.s.settings.themes ?? []).filter((t) => t.name.toLowerCase() !== n.toLowerCase()),
            { name: n, color: this.desc, style: "highlight" }
          ];
          const sp = themeSpec(n, sim, COLOR_HEX);
          badge.setText(sp.emoji);
          swatch.style.background = `linear-gradient(120deg, ${sp.c1}, ${sp.c2})`;
        };
        new import_obsidian10.Setting(this.contentEl).setName("Theme name").addText((t) => t.setPlaceholder("Faith").onChange((v) => {
          name = v;
          preview(v);
        }));
        new import_obsidian10.Setting(this.contentEl).addButton((b) => b.setButtonText("Save theme").setCta().onClick(() => {
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
var import_obsidian19 = require("obsidian");
init_src();

// src/state.ts
var import_obsidian = require("obsidian");
init_src();
var CANONICAL_PREFIX = "AI Library/01 Scriptures/Canonical/";
var ANNOTATED_PREFIX = "AI Library/01 Scriptures/Annotated/";
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
  debugOverlay: false,
  barExpanded: false,
  lastChapter: null,
  recentChapters: [],
  showAiLibrary: false,
  scene: "none",
  tlDepth: 2,
  swipeNav: true
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

// src/study/navigator.ts
var import_obsidian2 = require("obsidian");
init_src();

// src/study/navIcons.ts
var I = {
  "old-testament": {
    // a parchment scroll
    h: "#e7b95c",
    s: `<path d="M6 4.5h11a2.5 2.5 0 0 1 2.5 2.5v9.5"/>
        <path d="M6 4.5A2.5 2.5 0 0 0 3.5 7v10A2.5 2.5 0 0 0 6 19.5h11.5a2 2 0 0 0 2-2v-1"/>
        <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>`
  },
  "new-testament": {
    // a rounded cross
    h: "#b79cff",
    s: `<path d="M12 4.5v15M6.5 9.5h11"/>
        <path d="M12 4.5v15" opacity="0.35" stroke-width="4.4"/>`
  },
  "book-of-mormon": {
    // book + bookmark
    h: "#52c7a0",
    s: `<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11A2.5 2.5 0 0 0 5 21z"/>
        <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19"/>
        <path d="M13.5 3v7l2-1.6 2 1.6V3"/>`
  },
  doctrine: {
    // a skeleton key
    h: "#f0c548",
    s: `<circle cx="8" cy="8" r="4"/>
        <path d="M10.8 10.8 19 19M15.5 15.5l3-3M17.5 17.5l2.4-2.4"/>`
  },
  pearl: {
    // a faceted gem
    h: "#6ad4e8",
    s: `<path d="M7 4h10l4 5-9 11L3 9z"/>
        <path d="M3 9h18M7 4l5 5 5-5M12 9v11"/>`
  },
  timeline: {
    // a constellation
    h: "#52a9ff",
    s: `<circle cx="6" cy="17" r="2"/>
        <circle cx="12" cy="7" r="2.4"/>
        <circle cx="18.5" cy="14.5" r="1.7"/>
        <path d="M7.3 15.3 10.6 9M14 8.4l3.2 4.6"/>`
  },
  library: {
    // leaning book spines
    h: "#f08fb0",
    s: `<path d="M4.5 4.5v15M9.5 4.5v15"/>
        <path d="m13.6 5.4 4.6 13.7"/>
        <path d="M4.5 8h5M13.9 9.3l4.4-1.4"/>`
  },
  hub: {
    // home, lit window
    h: "#ffab70",
    s: `<path d="m4 11 8-6.5L20 11"/>
        <path d="M6 9.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9.8"/>
        <path d="M10.3 20v-4.6a1.7 1.7 0 0 1 3.4 0V20"/>`
  },
  groups: {
    // two companions
    h: "#a78bfa",
    s: `<circle cx="9" cy="8.5" r="3"/>
        <path d="M3.5 19.5v-1a5.5 5.5 0 0 1 11 0v1"/>
        <circle cx="16.8" cy="9.5" r="2.3"/>
        <path d="M16 14.6a4.6 4.6 0 0 1 4.9 4.4v.5"/>`
  },
  search: {
    // the lens
    h: "#8fa3c8",
    s: `<circle cx="10.5" cy="10.5" r="6"/>
        <path d="m15.2 15.2 5 5"/>`
  },
  continue: {
    // play
    h: "#c9b8ff",
    s: `<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2a.8.8 0 0 0-1.2.7z"/>`
  },
  target: {
    // straight to it
    h: "#7cc4ff",
    s: `<circle cx="12" cy="12" r="7.5"/>
        <circle cx="12" cy="12" r="3.2"/>
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>`
  },
  verse: {
    // an open quote
    h: "#8fd8b8",
    s: `<path d="M5 7.5A3.5 3.5 0 0 1 8.5 4v0A6.5 6.5 0 0 0 5 9.8V16a2 2 0 0 0 2 2h2.5a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2H5z"/>
        <path d="M13.5 7.5A3.5 3.5 0 0 1 17 4v0a6.5 6.5 0 0 0-3.5 5.8V16a2 2 0 0 0 2 2H18a2 2 0 0 0 2-2v-3.5a2 2 0 0 0-2-2h-4.5z"/>`
  },
  page: {
    // a document
    h: "#9db4d8",
    s: `<path d="M7 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/>
        <path d="M13.5 3.5V8h4.6M8.5 12.5h7M8.5 16h5"/>`
  },
  chapter: {
    // an open book
    h: "#8ec7f0",
    s: `<path d="M12 6.5C10.5 5 8.2 4.3 5.5 4.3c-.8 0-1.5.06-2 .16V18c.5-.1 1.2-.16 2-.16 2.7 0 5 .7 6.5 2.16 1.5-1.46 3.8-2.16 6.5-2.16.8 0 1.5.06 2 .16V4.46c-.5-.1-1.2-.16-2-.16-2.7 0-5 .7-6.5 2.2z"/>
        <path d="M12 6.5V20"/>`
  },
  folder: {
    // a shelf drawer
    h: "#d9b36a",
    s: `<path d="M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>`
  },
  conference: {
    // the pulpit mic
    h: "#f4a6c0",
    s: `<rect x="9" y="3.5" width="6" height="11" rx="3"/>
        <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5M9 20.5h6"/>`
  },
  dictionary: {
    // book of words
    h: "#c9a3f5",
    s: `<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h11a.5.5 0 0 1 .5.5v15a.5.5 0 0 1-.5.5h-11A2.5 2.5 0 0 0 5 21z"/>
        <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19"/>
        <path d="m9.8 12.5 2.2-5.5 2.2 5.5M10.5 10.8h3"/>`
  },
  topics: {
    // a tag
    h: "#79d2c3",
    s: `<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11l8.6 8.6a2 2 0 0 1 0 2.8l-4.2 4.2a2 2 0 0 1-2.8 0L4 11z"/>
        <circle cx="8.6" cy="8.6" r="1.4"/>`
  },
  person: {
    // one soul
    h: "#f0b884",
    s: `<circle cx="12" cy="8" r="3.6"/>
        <path d="M5 20v-.8a7 7 0 0 1 14 0v.8"/>`
  },
  place: {
    // a map pin
    h: "#8fd0f4",
    s: `<path d="M12 21s-6.5-5.7-6.5-10.3a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z"/>
        <circle cx="12" cy="10.5" r="2.3"/>`
  },
  event: {
    // a marked day
    h: "#f2c063",
    s: `<rect x="4" y="5.5" width="16" height="15" rx="2"/>
        <path d="M8 3.5v4M16 3.5v4M4 10.5h16M9.5 15.5l1.8 1.8 3.4-3.4"/>`
  },
  doctrines: {
    // engraved lines
    h: "#a4c8f0",
    s: `<path d="M7 3.5h10A1.5 1.5 0 0 1 18.5 5v14a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z"/>
        <path d="M9 8h6M9 11.5h6M9 15h3.5"/>`
  },
  papers: {
    // the archive box
    h: "#c8b090",
    s: `<rect x="3.5" y="4.5" width="17" height="5" rx="1"/>
        <path d="M5.5 9.5V18A1.5 1.5 0 0 0 7 19.5h10a1.5 1.5 0 0 0 1.5-1.5V9.5M10 13h4"/>`
  },
  history: {
    // pillars
    h: "#d8c8a0",
    s: `<path d="m4 8 8-4.5L20 8M5 8.5h14"/>
        <path d="M6.5 11v6M12 11v6M17.5 11v6M4.5 19.5h15"/>`
  },
  evidence: {
    // examined + proven
    h: "#84d89c",
    s: `<circle cx="10.5" cy="10.5" r="6"/>
        <path d="m15.2 15.2 5 5M8.2 10.6l1.7 1.7 3-3"/>`
  },
  question: {
    // an honest question
    h: "#a8b8f8",
    s: `<circle cx="12" cy="12" r="8.5"/>
        <path d="M9.6 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.4 2-2.4 3.6"/>
        <path d="M12.1 16.8h.01"/>`
  },
  scholarship: {
    // the cap
    h: "#b8d4f8",
    s: `<path d="m2.5 9.5 9.5-4.5 9.5 4.5-9.5 4.5z"/>
        <path d="M6.5 11.7V16c0 1.4 2.5 2.7 5.5 2.7s5.5-1.3 5.5-2.7v-4.3M21 10v5"/>`
  },
  podcast: {
    // voice in the air
    h: "#f0a8a0",
    s: `<circle cx="12" cy="11" r="2.6"/>
        <path d="M8.2 15.4a5.3 5.3 0 1 1 7.6 0M12 14v6.5"/>
        <path d="M5.6 17.5a9 9 0 1 1 12.8 0" opacity="0.55"/>`
  }
};
function navIcon(parent, name) {
  const d = I[name] ?? I.page;
  const span = parent.createSpan({ cls: "sg-nav-ico" });
  span.style.setProperty("--ico", d.h);
  span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d.s}</svg>`;
  return span;
}
function cascade(el, i) {
  el.style.animationDelay = `${Math.min(i * 26, 340)}ms`;
}

// src/study/search.ts
init_src();
function normalize(s) {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}+/gu, "").replace(/['’ʼ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
var SUFFIXES = ["eth", "est", "ings", "ing", "ed", "es", "s", "'s"];
function stem(t) {
  for (const suf of SUFFIXES) {
    if (t.endsWith(suf) && t.length - suf.length >= 3) {
      return t.slice(0, t.length - suf.length);
    }
  }
  return t;
}
function tokenize(s) {
  const n = normalize(s);
  return n ? n.split(" ").map(stem) : [];
}
var VERSE_LINE_RE = /^\*\*(\d+)\*\*\s+(.*?)\s*\^([a-z0-9]+(?:-\d+)+)\s*$/;
function parseVerseLine(chapter, line) {
  const m = VERSE_LINE_RE.exec(line);
  if (!m) return null;
  const text = m[2];
  return {
    chapter,
    verse: Number(m[1]),
    text,
    anchor: m[3],
    norm: normalize(text),
    tokens: tokenize(text)
  };
}
var builtIndex = null;
var building = null;
var progressListeners = [];
function searchIndexReady() {
  return builtIndex !== null;
}
function buildSearchIndex(app, onProgress) {
  if (builtIndex) return Promise.resolve(builtIndex);
  if (onProgress) progressListeners.push(onProgress);
  if (building) return building;
  building = (async () => {
    const all = app.vault.getMarkdownFiles();
    const canonical = all.filter((f) => f.path.startsWith(CANONICAL_PREFIX));
    const verses = [];
    const chapters = [];
    let done = 0;
    for (const f of canonical) {
      const title = f.basename;
      chapters.push({ title, norm: normalize(title), tokens: tokenize(title) });
      try {
        const md = await app.vault.cachedRead(f);
        for (const line of md.split("\n")) {
          const rec = parseVerseLine(title, line);
          if (rec) verses.push(rec);
        }
      } catch {
      }
      done++;
      for (const p of progressListeners) p(done, canonical.length);
    }
    const pages = [];
    for (const f of all) {
      if (!f.path.startsWith(LIBRARY_PREFIX)) continue;
      if (f.path.includes("01 Scriptures/")) continue;
      if (f.basename.startsWith("_")) continue;
      const fm = app.metadataCache.getFileCache(f)?.frontmatter;
      const raw = fm?.["aliases"];
      const aliases = Array.isArray(raw) ? raw.map(String) : typeof raw === "string" ? [raw] : [];
      pages.push({ title: f.basename, path: f.path, aliases });
    }
    builtIndex = { verses, pages, chapters };
    building = null;
    progressListeners.length = 0;
    return builtIndex;
  })();
  return building;
}
var BOOK_LOOKUP = (() => {
  const m = /* @__PURE__ */ new Map();
  for (const b of BOOKS) {
    for (const form of [b.name, b.prefix, b.slug, ...b.aliases]) {
      const key = normalize(form);
      if (key) m.set(key, b);
    }
  }
  return m;
})();
function parseReference(q) {
  const m = /^(.+?)[\s.]*(\d{1,3})(?:\s*[:.]\s*(\d{1,3}))?$/.exec(q.trim());
  if (!m) return null;
  const book = BOOK_LOOKUP.get(normalize(m[1]));
  if (!book) return null;
  const chapter = Number(m[2]);
  if (chapter < 1 || chapter > book.chapters) return null;
  const verse = m[3] ? Number(m[3]) : null;
  if (verse !== null && verse < 1) return null;
  return {
    bookName: book.name,
    title: `${book.prefix} ${chapter}`,
    chapter,
    verse,
    anchor: verse !== null ? `${book.slug}-${chapter}-${verse}` : null
  };
}
function phraseAt(norm, qnorm) {
  const hay = ` ${norm} `;
  const i = hay.indexOf(` ${qnorm} `);
  return i < 0 ? -1 : i;
}
function tokenMatches(token, q, isLast, prefixOk) {
  return token === q || isLast && prefixOk && q.length >= 2 && token.startsWith(q);
}
function scoreTokens(tokens, qtokens, prefixOk) {
  const n = qtokens.length;
  if (!n || !tokens.length) return { tier: 9, score: 0 };
  let present = 0;
  for (let qi = 0; qi < n; qi++) {
    const q = qtokens[qi];
    const isLast = qi === n - 1;
    for (const t of tokens) {
      if (tokenMatches(t, q, isLast, prefixOk)) {
        present++;
        break;
      }
    }
  }
  const need = n >= 2 ? Math.ceil(n / 2) : 1;
  if (present < need) return { tier: 9, score: 0 };
  const tier = present === n ? 2 : 3;
  const last = new Array(n).fill(-1);
  let bestSpan = Infinity;
  let bestStart = -1;
  let bestOrdered = false;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    for (let qi = 0; qi < n; qi++) {
      if (tokenMatches(t, qtokens[qi], qi === n - 1, prefixOk)) last[qi] = i;
    }
    let lo = Infinity, hi = -1, have = 0;
    for (let qi = 0; qi < n; qi++) {
      const p = last[qi];
      if (p < 0) continue;
      have++;
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    if (have < present) continue;
    const span = hi - lo;
    if (span < bestSpan || span === bestSpan && bestStart < 0) {
      bestSpan = span;
      bestStart = lo;
      let ordered = true;
      for (let qi = 1; qi < n; qi++) {
        const a = last[qi - 1], b = last[qi];
        if (a >= 0 && b >= 0 && a > b) {
          ordered = false;
          break;
        }
      }
      bestOrdered = ordered;
    }
  }
  if (bestStart < 0) return { tier: 9, score: 0 };
  const slack = bestSpan - (present - 1);
  const score = 60 / (1 + slack) + (bestOrdered ? 12 : 0) + 10 / (1 + bestStart) + 6 / (1 + tokens.length / 12) + present * 4;
  return { tier, score };
}
function scoreText(norm, tokens, qnorm, qtokens) {
  if (qnorm) {
    const at = phraseAt(norm, qnorm);
    if (at >= 0) {
      return {
        tier: 1,
        score: 100 + 20 / (1 + at / 8) + 8 / (1 + tokens.length / 12)
      };
    }
  }
  return scoreTokens(tokens, qtokens, true);
}
function scoreTitle(title, qnorm, qtokens) {
  return scoreTitleParts(normalize(title), tokenize(title), qnorm, qtokens);
}
function scoreTitleParts(norm, tokens, qnorm, qtokens) {
  if (!norm) return { tier: 9, score: 0 };
  if (norm === qnorm) return { tier: 1, score: 400 };
  if (qnorm && norm.startsWith(qnorm)) return { tier: 1, score: 300 - norm.length };
  const base = scoreText(norm, tokens, qnorm, qtokens);
  if (base.tier >= 9) return base;
  const first = norm.split(" ")[0];
  const qFirst = qtokens[0] ?? "";
  const startsish = qFirst && (first === qFirst || first.startsWith(qFirst));
  return { tier: base.tier, score: base.score + (startsish ? 30 : 0) };
}
function rawWords(text) {
  const out = [];
  const re = /[A-Za-z0-9À-ɏ'’ʼ]+/g;
  let m;
  while (m = re.exec(text)) {
    const w = normalize(m[0]);
    if (!w) continue;
    out.push({ start: m.index, end: m.index + m[0].length, norm: w, stemmed: stem(w) });
  }
  return out;
}
function matchRanges(text, qnorm, qtokens) {
  const words = rawWords(text);
  const phrase = qnorm ? qnorm.split(" ") : [];
  if (phrase.length) {
    for (let i = 0; i + phrase.length <= words.length; i++) {
      let ok = true;
      for (let j = 0; j < phrase.length; j++) {
        if (words[i + j].norm !== phrase[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return [{ start: words[i].start, end: words[i + phrase.length - 1].end }];
      }
    }
  }
  const ranges = [];
  const n = qtokens.length;
  for (const w of words) {
    for (let qi = 0; qi < n; qi++) {
      if (tokenMatches(w.stemmed, qtokens[qi], qi === n - 1, true)) {
        ranges.push({ start: w.start, end: w.end });
        break;
      }
    }
  }
  return ranges;
}
var SNIPPET_LEN = 140;
function makeSnippet(text, ranges) {
  if (text.length <= SNIPPET_LEN) return { snippet: text, ranges };
  if (!ranges.length) {
    const cut = text.lastIndexOf(" ", SNIPPET_LEN);
    return { snippet: `${text.slice(0, cut > 60 ? cut : SNIPPET_LEN)}\u2026`, ranges: [] };
  }
  const first = ranges[0];
  let start = Math.max(0, first.start - 36);
  if (start > 0) {
    const sp = text.indexOf(" ", start);
    if (sp >= 0 && sp < first.start) start = sp + 1;
  }
  let end = Math.min(text.length, start + SNIPPET_LEN);
  if (end < text.length) {
    const sp = text.lastIndexOf(" ", end);
    if (sp > start + SNIPPET_LEN / 2) end = sp;
  }
  const prefix = start > 0 ? "\u2026" : "";
  const suffix = end < text.length ? "\u2026" : "";
  const body = text.slice(start, end);
  const shift = start - prefix.length;
  const kept = ranges.filter((r) => r.start >= start && r.end <= end).map((r) => ({ start: r.start - shift, end: r.end - shift }));
  return { snippet: prefix + body + suffix, ranges: kept };
}
var byRank = (a, b) => a.tier - b.tier || b.score - a.score;
function smartSearch(q, index) {
  const qnorm = normalize(q);
  const qtokens = tokenize(q);
  const out = { verses: [], pages: [], chapters: [] };
  if (!qtokens.length) return out;
  const ref = parseReference(q);
  if (ref) out.reference = ref;
  const vhits = [];
  for (const rec of index.verses) {
    const s = scoreText(rec.norm, rec.tokens, qnorm, qtokens);
    if (s.tier < 9) vhits.push({ rec, tier: s.tier, score: s.score });
  }
  vhits.sort(byRank);
  for (const h of vhits.slice(0, 8)) {
    const { snippet, ranges } = makeSnippet(h.rec.text, matchRanges(h.rec.text, qnorm, qtokens));
    out.verses.push({
      chapter: h.rec.chapter,
      verse: h.rec.verse,
      anchor: h.rec.anchor,
      snippet,
      ranges,
      tier: h.tier,
      score: h.score
    });
  }
  const phits = [];
  for (const rec of index.pages) {
    let best = scoreTitle(rec.title, qnorm, qtokens);
    for (const a of rec.aliases) {
      const s = scoreTitle(a, qnorm, qtokens);
      if (byRank(s, best) < 0) best = s;
    }
    if (best.tier < 9) phits.push({ rec, tier: best.tier, score: best.score });
  }
  phits.sort(byRank);
  out.pages = phits.slice(0, 6).map((h) => ({
    title: h.rec.title,
    path: h.rec.path,
    tier: h.tier,
    score: h.score
  }));
  const chits = [];
  for (const rec of index.chapters) {
    if (ref && rec.title === ref.title) continue;
    const s = scoreTitleParts(rec.norm, rec.tokens, qnorm, qtokens);
    if (s.tier < 9) chits.push({ rec, tier: s.tier, score: s.score });
  }
  chits.sort(byRank);
  out.chapters = chits.slice(0, 4).map((h) => ({ title: h.rec.title, tier: h.tier, score: h.score }));
  return out;
}

// src/study/navigator.ts
var LIBRARY_SECTIONS = [
  { icon: "conference", name: "General Conference", path: "AI Library/10 General Conference" },
  { icon: "dictionary", name: "Bible Dictionary", path: "AI Library/80 Bible Dictionary" },
  { icon: "topics", name: "Gospel Topics", path: "AI Library/02 Gospel Topics" },
  { icon: "person", name: "People", path: "AI Library/03 People" },
  { icon: "place", name: "Places", path: "AI Library/04 Places" },
  { icon: "event", name: "Events", path: "AI Library/05 Events" },
  { icon: "doctrines", name: "Doctrines", path: "AI Library/06 Doctrines" },
  { icon: "papers", name: "Joseph Smith Papers", path: "AI Library/20 Joseph Smith Papers" },
  { icon: "history", name: "Church History", path: "AI Library/30 Church History" },
  { icon: "evidence", name: "Evidence", path: "AI Library/40 Evidence" },
  { icon: "question", name: "Questions", path: "AI Library/50 Questions" },
  { icon: "scholarship", name: "Scholarship", path: "AI Library/60 Scholarship" },
  { icon: "podcast", name: "Podcasts & talks", path: "AI Library/65 Secondary Sources" }
];
function titleForChapterSlug(slug) {
  const m = /^(.+)-(\d+)$/.exec(slug);
  if (!m) return null;
  return chapterTitle(m[1], Number(m[2]));
}
var VOLUMES = [
  { name: "Old Testament", icon: "old-testament" },
  { name: "New Testament", icon: "new-testament" },
  { name: "Book of Mormon", icon: "book-of-mormon" },
  { name: "Doctrine and Covenants", icon: "doctrine" },
  { name: "Pearl of Great Price", icon: "pearl" }
];
var SGNavigatorModal = class extends import_obsidian2.Modal {
  constructor(app, host) {
    super(app);
    this.host = host;
    const last = host.lastChapter();
    if (last) {
      const book = BOOKS.find((b) => last.slug.startsWith(`${b.slug}-`));
      if (book) this.view = { kind: "chapters", book };
    }
  }
  view = { kind: "home" };
  trail = [];
  searchQuery = "";
  searchTimer = null;
  searchSeq = 0;
  groupActs = null;
  onOpen() {
    this.render();
  }
  /** leave the way we arrived: a quick fade-down instead of a hard pop */
  closing = false;
  close() {
    if (this.closing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      super.close();
      return;
    }
    this.closing = true;
    this.modalEl.addClass("sg-nav-out");
    this.modalEl.parentElement?.addClass("sg-nav-bg-out");
    window.setTimeout(() => super.close(), 150);
  }
  onClose() {
    if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
    this.contentEl.empty();
  }
  /** drill somewhere, remembering where we came from */
  go(v) {
    this.trail.push(this.view);
    this.view = v;
    this.render();
  }
  back() {
    const prev = this.trail.pop();
    if (prev) {
      this.view = prev;
      this.render();
      return;
    }
    const v = this.view;
    this.view = v.kind === "chapters" ? { kind: "books", volume: v.book.volume } : v.kind === "folder" ? { kind: "library" } : { kind: "home" };
    this.render();
  }
  render() {
    const c = this.contentEl;
    c.empty();
    c.addClass("sg-nav");
    this.modalEl.addClass("sg-nav-modal");
    const v = this.view;
    const head = c.createDiv({ cls: "sg-nav-head" });
    if (v.kind !== "home") {
      const back = head.createEl("button", { cls: "sg-nav-btn sg-nav-back", text: "\u2039" });
      back.setAttr("aria-label", "Back");
      back.onclick = () => this.back();
    }
    head.createSpan({
      cls: "sg-nav-title",
      text: v.kind === "home" ? "Scriptures" : v.kind === "books" ? v.volume : v.kind === "chapters" ? v.book.name : v.kind === "library" ? "Library" : v.title
    });
    if (v.kind !== "home") {
      const home = head.createEl("button", { cls: "sg-nav-btn sg-nav-homebtn", text: "\u2302" });
      home.setAttr("aria-label", "Home");
      home.onclick = () => {
        this.trail = [];
        this.view = { kind: "home" };
        this.render();
      };
    }
    if (v.kind === "home") this.renderHome(c);
    else if (v.kind === "books") this.renderBooks(c, v.volume);
    else if (v.kind === "chapters") this.renderChapters(c, v.book);
    else if (v.kind === "library") this.renderLibrary(c);
    else this.renderFolder(c, v.path);
  }
  /** Home = a search box over the browsing rows. Under 2 chars the rows
   * show; at 2+ the smart search takes the body over, and clearing the box
   * hands it back. */
  renderHome(c) {
    const wrap = c.createDiv({ cls: "sg-nav-searchwrap" });
    navIcon(wrap, "search").addClass("sg-nav-searchico");
    const inp = wrap.createEl("input", {
      cls: "sg-nav-filter sg-nav-search",
      attr: { type: "search", placeholder: "Search scriptures, people, places\u2026", enterkeyhint: "search" }
    });
    inp.value = this.searchQuery;
    const body = c.createDiv({ cls: "sg-nav-searchhost" });
    const showHome = () => {
      this.searchSeq++;
      body.removeClass("sg-nav-scroll");
      body.empty();
      this.renderHomeRows(body);
    };
    inp.oninput = () => {
      this.searchQuery = inp.value;
      if (this.searchTimer !== null) window.clearTimeout(this.searchTimer);
      const q = inp.value.trim();
      if (q.length < 2) {
        this.searchTimer = null;
        showHome();
        return;
      }
      this.searchTimer = window.setTimeout(() => {
        this.searchTimer = null;
        this.runSearch(q, body);
      }, 160);
    };
    const q0 = this.searchQuery.trim();
    if (q0.length >= 2) this.runSearch(q0, body);
    else this.renderHomeRows(body);
  }
  /** First search of the session builds the index; a quiet progress row
   * keeps the wait honest, then results replace it. A failed build says so
   * instead of stranding the progress row forever. */
  runSearch(q, body) {
    const seq = ++this.searchSeq;
    const fail = () => {
      if (seq !== this.searchSeq || this.view.kind !== "home") return;
      body.empty();
      body.createDiv({ cls: "sg-nav-progress", text: "Search isn't available right now." });
    };
    if (!searchIndexReady()) {
      body.empty();
      const prog = body.createDiv({ cls: "sg-nav-progress", text: "Reading the scriptures\u2026 0%" });
      buildSearchIndex(this.app, (done, total) => {
        const pct = total ? Math.round(done / total * 100) : 100;
        prog.setText(`Reading the scriptures\u2026 ${pct}%`);
      }).then((index) => {
        if (seq !== this.searchSeq || this.view.kind !== "home") return;
        this.renderResults(smartSearch(q, index), body);
      }).catch(fail);
      return;
    }
    buildSearchIndex(this.app).then((index) => {
      if (seq !== this.searchSeq || this.view.kind !== "home") return;
      this.renderResults(smartSearch(q, index), body);
    }).catch(fail);
  }
  renderResults(res, body) {
    body.empty();
    body.addClass("sg-nav-scroll");
    const open2 = (go) => {
      go();
      this.close();
    };
    if (!res.reference && !res.verses.length && !res.pages.length && !res.chapters.length) {
      body.createDiv({ cls: "sg-nav-empty", text: "Nothing found. Try fewer or different words." });
      return;
    }
    let ri = 0;
    if (res.reference || res.verses.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Scriptures" });
    }
    if (res.reference) {
      const ref = res.reference;
      const row = body.createDiv({ cls: "sg-nav-row sg-nav-refrow" });
      cascade(row, ri++);
      navIcon(row, "target");
      const col = row.createDiv({ cls: "sg-nav-gcol" });
      col.createDiv({ cls: "sg-nav-name", text: ref.verse !== null ? `${ref.title}:${ref.verse}` : ref.title });
      col.createDiv({ cls: "sg-nav-gsub", text: ref.verse !== null ? "Go to verse" : "Open chapter" });
      row.onclick = () => open2(() => {
        if (ref.anchor) this.host.openNote(`${ref.title}#^${ref.anchor}`);
        else this.host.openChapter(ref.title);
      });
    }
    for (const v of res.verses) {
      const row = body.createDiv({ cls: "sg-nav-row sg-nav-vrow" });
      cascade(row, ri++);
      const col = row.createDiv({ cls: "sg-nav-vcol" });
      col.createDiv({ cls: "sg-nav-vref", text: `${v.chapter}:${v.verse}` });
      const snip = col.createDiv({ cls: "sg-nav-snip" });
      let at = 0;
      for (const r of v.ranges) {
        if (r.start > at) snip.createSpan({ text: v.snippet.slice(at, r.start) });
        snip.createEl("b", { text: v.snippet.slice(r.start, r.end) });
        at = r.end;
      }
      if (at < v.snippet.length) snip.createSpan({ text: v.snippet.slice(at) });
      row.onclick = () => open2(() => this.host.openNote(`${v.chapter}#^${v.anchor}`));
    }
    if (res.pages.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Library" });
      for (const p of res.pages) {
        const row = body.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, ri++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: p.title });
        row.onclick = () => open2(() => this.host.openPath(p.path));
      }
    }
    if (res.chapters.length) {
      body.createDiv({ cls: "sg-nav-sect", text: "Chapters" });
      for (const ch of res.chapters) {
        const row = body.createDiv({ cls: "sg-nav-row" });
        cascade(row, ri++);
        navIcon(row, "chapter");
        row.createSpan({ cls: "sg-nav-name", text: ch.title });
        row.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
        row.onclick = () => open2(() => this.host.openChapter(ch.title));
      }
    }
  }
  renderHomeRows(c) {
    const last = this.host.lastChapter();
    if (last) {
      const cont = c.createDiv({ cls: "sg-nav-continue" });
      navIcon(cont, "continue").addClass("sg-nav-continue-ico");
      const col = cont.createDiv({ cls: "sg-nav-continue-col" });
      col.createSpan({ cls: "sg-nav-continue-tag", text: "Continue reading" });
      col.createSpan({ cls: "sg-nav-continue-title", text: last.title });
      cont.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
      cont.onclick = () => {
        this.close();
        this.host.openChapter(last.title);
      };
    }
    const rec = this.host.recentChapters().filter((r) => r.slug !== last?.slug).slice(0, 4);
    if (rec.length) {
      const row = c.createDiv({ cls: "sg-nav-recent" });
      for (const r of rec) {
        const pill = row.createEl("button", { cls: "sg-nav-recent-pill", text: r.title });
        pill.onclick = () => {
          this.close();
          this.host.openChapter(r.title);
        };
      }
    }
    const list = c.createDiv({ cls: "sg-nav-list" });
    let i = 0;
    for (const vol of VOLUMES) {
      const row = list.createDiv({ cls: "sg-nav-row" });
      cascade(row, i++);
      navIcon(row, vol.icon);
      row.createSpan({ cls: "sg-nav-name", text: vol.name });
      row.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
      row.onclick = () => {
        const books = BOOKS.filter((b) => b.volume === vol.name);
        this.go(books.length === 1 ? { kind: "chapters", book: books[0] } : { kind: "books", volume: vol.name });
      };
    }
    const tl = list.createDiv({ cls: "sg-nav-row sg-nav-tl" });
    cascade(tl, i++);
    navIcon(tl, "timeline");
    tl.createSpan({ cls: "sg-nav-name", text: "Timeline" });
    tl.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
    tl.onclick = () => {
      this.close();
      this.host.openTimeline();
    };
    const lib = list.createDiv({ cls: "sg-nav-row sg-nav-lib" });
    cascade(lib, i++);
    navIcon(lib, "library");
    lib.createSpan({ cls: "sg-nav-name", text: "Library" });
    lib.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
    lib.onclick = () => this.go({ kind: "library" });
    const hub = list.createDiv({ cls: "sg-nav-row sg-nav-hub" });
    cascade(hub, i++);
    navIcon(hub, "hub");
    hub.createSpan({ cls: "sg-nav-name", text: "Study Hub" });
    hub.onclick = () => {
      this.close();
      this.host.openNote("Study Hub");
    };
    const groupsBox = c.createDiv({ cls: "sg-nav-groups" });
    const actsP = this.groupActs ? Promise.resolve(this.groupActs) : this.host.groupActivity();
    void actsP.then((acts) => {
      this.groupActs = acts;
      if (!acts.length || this.view.kind !== "home" || !groupsBox.isConnected) return;
      groupsBox.createDiv({ cls: "sg-nav-sect", text: "Studying with your groups" });
      for (const a of acts.slice(0, 4)) {
        const title = titleForChapterSlug(a.chapter_slug);
        if (!title) continue;
        const row = groupsBox.createDiv({ cls: "sg-nav-row sg-nav-group" });
        navIcon(row, "groups");
        const col = row.createDiv({ cls: "sg-nav-gcol" });
        col.createDiv({ cls: "sg-nav-name", text: title });
        col.createDiv({
          cls: "sg-nav-gsub",
          text: `${a.group_name} \xB7 ${a.count} note${a.count === 1 ? "" : "s"}` + (a.others ? "" : " (all yours)")
        });
        row.onclick = () => {
          this.close();
          this.host.openChapter(title);
        };
      }
    }).catch(() => {
    });
  }
  renderBooks(c, volume) {
    const grid = c.createDiv({ cls: "sg-nav-books" });
    let i = 0;
    for (const b of BOOKS.filter((x) => x.volume === volume)) {
      const pill = grid.createEl("button", { cls: "sg-nav-book", text: b.name });
      cascade(pill, i++);
      pill.onclick = () => this.go({ kind: "chapters", book: b });
    }
  }
  renderLibrary(c) {
    const list = c.createDiv({ cls: "sg-nav-list sg-nav-scroll" });
    let i = 0;
    for (const s of LIBRARY_SECTIONS) {
      const l = this.host.listFolder(s.path);
      if (!l.folders.length && !l.files.length) continue;
      const row = list.createDiv({ cls: "sg-nav-row" });
      cascade(row, i++);
      navIcon(row, s.icon);
      row.createSpan({ cls: "sg-nav-name", text: s.name });
      row.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
      row.onclick = () => this.go({ kind: "folder", path: s.path, title: s.name });
    }
  }
  renderFolder(c, path) {
    const listing = this.host.listFolder(path);
    const yearish = listing.folders.length > 3 && listing.folders.every((f) => /^\d{4}$/.test(f.name));
    const folders = yearish ? [...listing.folders].reverse() : listing.folders;
    let filter = "";
    const list = c.createDiv({ cls: "sg-nav-list sg-nav-scroll" });
    const renderRows = () => {
      list.empty();
      const q = filter.toLowerCase();
      let i = 0;
      for (const f of folders) {
        if (q && !f.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row" });
        cascade(row, i++);
        navIcon(row, "folder");
        row.createSpan({ cls: "sg-nav-name", text: f.name });
        row.createSpan({ cls: "sg-nav-chev", text: "\u203A" });
        row.onclick = () => this.go({ kind: "folder", path: f.path, title: f.name });
      }
      for (const fi of listing.files) {
        if (q && !fi.name.toLowerCase().includes(q)) continue;
        const row = list.createDiv({ cls: "sg-nav-row sg-nav-file" });
        cascade(row, i++);
        navIcon(row, "page");
        row.createSpan({ cls: "sg-nav-name", text: fi.name });
        row.onclick = () => {
          this.close();
          this.host.openPath(fi.path);
        };
      }
      if (!list.childElementCount) {
        list.createDiv({ cls: "sg-nav-empty", text: "Nothing here matches." });
      }
    };
    if (folders.length + listing.files.length > 30) {
      const inp = c.createEl("input", {
        cls: "sg-nav-filter",
        attr: { type: "search", placeholder: "Type to filter\u2026" }
      });
      inp.oninput = () => {
        filter = inp.value;
        renderRows();
      };
      c.insertBefore(inp, list);
    }
    renderRows();
  }
  renderChapters(c, book) {
    const cur = this.host.lastChapter();
    const grid = c.createDiv({ cls: "sg-nav-chapters" });
    for (let n = 1; n <= book.chapters; n++) {
      const btn = grid.createEl("button", { cls: "sg-nav-ch", text: String(n) });
      cascade(btn, Math.floor((n - 1) / 6));
      if (cur?.slug === `${book.slug}-${n}`) btn.addClass("sg-nav-ch-now");
      btn.onclick = () => {
        this.close();
        this.host.openChapter(`${book.prefix} ${n}`);
      };
    }
  }
};

// src/study/libraryPreview.ts
var import_obsidian3 = require("obsidian");
init_sheetRegistry();
var NAVIGATE_PREFIXES = [CANONICAL_PREFIX, ANNOTATED_PREFIX];
function sheetTargetFor(app, linktext, sourcePath) {
  if (!linktext) return null;
  const base = linktext.split("#")[0].trim();
  if (!base) return null;
  const dest = app.metadataCache.getFirstLinkpathDest(base, sourcePath);
  if (!dest) return null;
  if (!dest.path.startsWith(LIBRARY_PREFIX)) return null;
  if (NAVIGATE_PREFIXES.some((p) => dest.path.startsWith(p))) return null;
  return dest;
}
var LibraryPreviewModal = class extends import_obsidian3.Modal {
  constructor(s, file, subpath, openAsPage, timeline = null) {
    super(s.app);
    this.s = s;
    this.subpath = subpath;
    this.openAsPage = openAsPage;
    this.timeline = timeline;
    this.current = file;
  }
  comp = new import_obsidian3.Component();
  history = [];
  current;
  bodyEl;
  sheetTitleEl;
  backBtn;
  tlBtn = null;
  onOpen() {
    registerSheet(this);
    this.modalEl.addClass("sg-lib-modal");
    const c = this.contentEl;
    c.addClass("sg-lib");
    this.comp.load();
    const head = c.createDiv({ cls: "sg-lib-head" });
    this.backBtn = head.createEl("button", { cls: "sg-lib-btn sg-lib-back", text: "\u2039" });
    this.backBtn.setAttr("aria-label", "Back");
    this.backBtn.onclick = () => {
      const prev = this.history.pop();
      if (prev) void this.show(prev, null);
    };
    this.sheetTitleEl = head.createSpan({ cls: "sg-lib-title" });
    if (this.timeline) {
      const tl = head.createEl("button", { cls: "sg-lib-btn sg-lib-tl", text: "\u23F3" });
      tl.setAttr("aria-label", "See it in the Timeline");
      tl.onclick = () => {
        const sub = this.timeline?.subjectFor(this.current.basename);
        if (!sub) return;
        const focus = this.timeline.focus;
        this.close();
        focus(sub);
      };
      this.tlBtn = tl;
      window.setTimeout(() => this.tlBtn?.toggleClass(
        "sg-lib-tl-off",
        !this.timeline?.subjectFor(this.current.basename)
      ), 450);
    }
    if (this.openAsPage) {
      const asPage = head.createEl("button", { cls: "sg-lib-btn sg-lib-expand", text: "\u2197" });
      asPage.setAttr("aria-label", "Open as its own page");
      asPage.onclick = () => {
        const f = this.current;
        const open2 = this.openAsPage;
        this.close();
        open2(f);
      };
    }
    this.bodyEl = c.createDiv({ cls: "sg-lib-body markdown-rendered" });
    this.bodyEl.addEventListener("click", (evt) => {
      const a = evt.target.closest("a.internal-link");
      if (!(a instanceof HTMLElement)) return;
      const href = a.getAttr("data-href") ?? a.getAttr("href") ?? "";
      if (!href) return;
      evt.preventDefault();
      evt.stopPropagation();
      const next = sheetTargetFor(this.s.app, href, this.current.path);
      if (next) {
        this.history.push(this.current);
        void this.show(next, href.split("#")[1] ?? null);
      } else if (href.includes("#^")) {
        void this.s.app.workspace.openLinkText(href, this.current.path);
      } else {
        this.close();
        void this.s.app.workspace.openLinkText(href, this.current.path);
      }
    }, { capture: true });
    void this.show(this.current, this.subpath);
  }
  async show(file, subpath) {
    this.current = file;
    this.sheetTitleEl.setText(file.basename);
    this.backBtn.toggleClass("sg-lib-back-off", this.history.length === 0);
    this.tlBtn?.toggleClass(
      "sg-lib-tl-off",
      !this.timeline?.subjectFor(file.basename)
    );
    this.bodyEl.empty();
    try {
      const md = await this.s.app.vault.cachedRead(file);
      await import_obsidian3.MarkdownRenderer.render(this.s.app, md, this.bodyEl, file.path, this.comp);
      this.bodyEl.scrollTop = 0;
      if (subpath && !subpath.startsWith("^")) {
        const want = subpath.toLowerCase();
        const h = Array.from(this.bodyEl.querySelectorAll("h1,h2,h3,h4,h5,h6")).find((el) => (el.textContent ?? "").trim().toLowerCase() === want);
        h?.scrollIntoView({ block: "start" });
      }
    } catch {
      this.bodyEl.setText("This page could not be loaded.");
    }
  }
  onClose() {
    unregisterSheet(this);
    this.comp.unload();
    this.contentEl.empty();
  }
};

// src/study/versePeek.ts
var import_obsidian4 = require("obsidian");
init_src();
init_sheetRegistry();
function peekTargetFor(app, linktext, sourcePath) {
  if (!linktext.includes("#^")) return null;
  const [base, anchor] = linktext.split("#^");
  const verseId = (anchor ?? "").trim();
  if (!base?.trim() || !parseVerseId(verseId)) return null;
  const dest = app.metadataCache.getFirstLinkpathDest(base.trim(), sourcePath);
  if (!dest || !dest.path.startsWith(CANONICAL_PREFIX)) return null;
  return { file: dest, chapterTitle: dest.basename, verseId };
}
var VERSE_RE = /^\*\*(\d+)\*\*\s+(.*?)\s*\^([a-z0-9]+(?:-\d+)+)\s*$/;
var VersePeekModal = class extends import_obsidian4.Modal {
  constructor(s, target, openChapter) {
    super(s.app);
    this.s = s;
    this.target = target;
    this.openChapter = openChapter;
  }
  onOpen() {
    registerSheet(this);
    this.modalEl.addClass("sg-peek-modal");
    const c = this.contentEl;
    c.addClass("sg-peek");
    c.createEl("h3", {
      cls: "sg-peek-title",
      text: `\u{1F4D6} ${verseDisplay(this.target.verseId) ?? this.target.chapterTitle}`
    });
    const body = c.createDiv({ cls: "sg-peek-body" });
    body.createDiv({ cls: "sg-peek-loading", text: "\u2026" });
    void this.render(body);
    const open2 = c.createEl("button", {
      cls: "sg-peek-open",
      text: `Open ${this.target.chapterTitle} \u25B8`
    });
    open2.onclick = () => {
      this.close();
      this.openChapter();
    };
  }
  async render(body) {
    let verses = [];
    try {
      const md = await this.s.app.vault.cachedRead(this.target.file);
      for (const line of md.split("\n")) {
        const m = VERSE_RE.exec(line);
        if (m) verses.push({ n: Number(m[1]), text: m[2], id: m[3] });
      }
    } catch {
    }
    body.empty();
    const i = verses.findIndex((v) => v.id === this.target.verseId);
    if (i < 0) {
      body.createDiv({ cls: "sg-peek-missing", text: "This verse could not be loaded." });
      return;
    }
    const before = verses[i - 1];
    const after = verses[i + 1];
    if (before) {
      body.createDiv({ cls: "sg-peek-ctx", text: `${before.n} ${before.text}` });
    }
    const main = body.createDiv({ cls: "sg-peek-verse" });
    main.createSpan({ cls: "sg-peek-num", text: String(verses[i].n) });
    main.createSpan({ text: ` ${verses[i].text}` });
    if (after) {
      body.createDiv({ cls: "sg-peek-ctx", text: `${after.n} ${after.text}` });
    }
  }
  onClose() {
    unregisterSheet(this);
    this.contentEl.empty();
  }
};

// src/main.ts
init_sheetRegistry();

// src/study/swipeNav.ts
var import_obsidian5 = require("obsidian");
init_src();
init_trace();
function adjacentChapterTitle(title, dir) {
  const id = chapterIdFromTitle(title);
  if (!id) return null;
  const dash = id.lastIndexOf("-");
  const bookSlug = id.slice(0, dash);
  const ch = Number(id.slice(dash + 1));
  const bi = BOOKS.findIndex((b) => b.slug === bookSlug);
  if (bi < 0) return null;
  const book = BOOKS[bi];
  const target = ch + dir;
  if (target >= 1 && target <= book.chapters) {
    return `${book.prefix} ${target}`;
  }
  const nb = BOOKS[bi + dir];
  if (!nb) return null;
  return dir === 1 ? `${nb.prefix} 1` : `${nb.prefix} ${nb.chapters}`;
}
function readingChapterTitle(f) {
  if (!f) return null;
  if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
    return f.basename.slice(0, -" - My Notes".length);
  }
  if (f.path.startsWith(CANONICAL_PREFIX)) return f.basename;
  if (f.path.startsWith(ANNOTATED_PREFIX)) {
    return f.basename.replace(/ \(Annotated\)$/, "");
  }
  return null;
}
var PAGE_SCROLLERS = [
  "markdown-reading-view",
  "markdown-preview-view",
  "markdown-preview-sizer",
  "markdown-source-view",
  "cm-scroller",
  "view-content"
];
function horizontalScrollerAt(el) {
  let n = el, hops = 0;
  while (n && hops++ < 8) {
    if (PAGE_SCROLLERS.some((c) => n.classList?.contains(c))) return null;
    if (n.scrollWidth > n.clientWidth + 4) {
      const o = getComputedStyle(n).overflowX;
      if (o === "auto" || o === "scroll") return n;
    }
    n = n.parentElement;
  }
  return null;
}
var turning = false;
function turnWordsFade(s, dir, next, openChapter) {
  if (turning) {
    openChapter(next);
    return;
  }
  turning = true;
  const b = document.body;
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const outCls = dir === 1 ? "sg-words-out-next" : "sg-words-out-prev";
  const go = () => {
    b.removeClass(outCls);
    b.addClass("sg-words-hidden");
    openChapter(next);
    const t0 = Date.now();
    const finish = () => {
      b.removeClass("sg-words-hidden");
      if (!still) {
        b.addClass("sg-words-in");
        window.setTimeout(() => b.removeClass("sg-words-in"), 420);
      }
      turning = false;
    };
    const ready = () => {
      if (readingChapterTitle(s.app.workspace.getActiveFile()) !== next) return false;
      const pv = document.querySelector(
        ".workspace-leaf.mod-active .markdown-preview-view"
      );
      return pv instanceof HTMLElement && pv.clientHeight > 0;
    };
    const tick = () => {
      if (ready()) {
        window.requestAnimationFrame(finish);
        return;
      }
      if (Date.now() - t0 > 900) {
        finish();
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };
  if (still) {
    go();
    return;
  }
  b.addClass(outCls);
  window.setTimeout(go, 210);
}
function registerSwipeNav(plugin, s, openChapter) {
  if (!import_obsidian5.Platform.isMobile) return;
  let start = null;
  plugin.registerDomEvent(document, "touchstart", (evt) => {
    start = null;
    if (s.device.swipeNav === false) return;
    if (evt.touches.length !== 1) return;
    if (document.body.hasClass("sg-selecting")) {
      trace("swipe.skip", { why: "selecting" });
      return;
    }
    const t = evt.touches[0];
    const target = evt.target;
    const reading = !!target?.closest(".markdown-reading-view, .markdown-preview-view");
    const sourcing = !reading && !!target?.closest(".markdown-source-view") && !document.activeElement?.closest(".cm-editor");
    if (!reading && !sourcing) {
      if (target?.closest(".workspace-leaf")) {
        trace("swipe.skip", { why: "not-reading", el: target?.className?.slice?.(0, 40) ?? "?" });
      }
      return;
    }
    if (target.closest(".sg-studybar, .modal, .menu, .sg-nav-fab, .sg-back-pill, .sg-tl")) {
      trace("swipe.skip", { why: "ui-chrome" });
      return;
    }
    const scroller = horizontalScrollerAt(target);
    if (scroller) {
      trace("swipe.skip", {
        why: "h-scroller",
        el: (scroller.className || scroller.tagName).slice(0, 40)
      });
      return;
    }
    if (t.clientX < 40 || t.clientX > window.innerWidth - 40) return;
    start = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, { passive: true });
  plugin.registerDomEvent(document, "touchend", (evt) => {
    const s0 = start;
    start = null;
    if (!s0) return;
    const t = evt.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s0.x;
    const dy = t.clientY - s0.y;
    const dt = Date.now() - s0.t;
    if (dt > 550 || Math.abs(dx) < 80 || Math.abs(dy) > 70 || Math.abs(dx) < Math.abs(dy) * 1.8) {
      if (Math.abs(dx) >= 40) {
        trace("swipe.miss", { dx: Math.round(dx), dy: Math.round(dy), dt });
      }
      return;
    }
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      trace("swipe.skip", { why: "selection", len: sel.toString().length });
      return;
    }
    const title = readingChapterTitle(s.app.workspace.getActiveFile());
    if (!title) {
      trace("swipe.skip", { why: "no-chapter", file: s.app.workspace.getActiveFile()?.basename ?? "none" });
      return;
    }
    const dir = dx < 0 ? 1 : -1;
    const next = adjacentChapterTitle(title, dir);
    if (!next) {
      trace("swipe.skip", { why: "canon-end", at: title });
      return;
    }
    try {
      navigator.vibrate?.(8);
    } catch {
    }
    trace("swipe.turn", { from: title, to: next, dx: Math.round(dx), dt });
    turnWordsFade(s, dir, next, openChapter);
  }, { passive: true });
  plugin.registerDomEvent(
    document,
    "touchcancel",
    () => {
      start = null;
    },
    { passive: true }
  );
}

// src/main.ts
init_timelineView();
init_annotations();

// src/social/readingIntegration.ts
var import_obsidian11 = require("obsidian");
init_annotations();
init_presence();

// src/social/connections.ts
var import_obsidian8 = require("obsidian");
init_src();
init_sheetRegistry();
var EXCLUDED_PREFIXES = [
  "AI Library/00 System/",
  "AI Library/01 Scriptures/Annotated/",
  "AI Library/01 Scriptures/Canonical/",
  "AI Library/01 Scriptures/Translations/"
];
var SECTIONS = [
  ["AI Library/40 Evidence/", "\u{1F50E}", 1],
  ["AI Library/90 Timeline/", "\u{1F570}", 2],
  ["AI Library/01 Scriptures/Cross References/", "\u{1F4D6}", 2],
  ["AI Library/02 Gospel Topics/", "\u{1F3F7}\uFE0F", 2],
  ["AI Library/01 Scriptures/Study Guides/", "\u{1F9E0}", 3],
  ["AI Library/03 People/", "\u{1F9D1}", 4],
  ["AI Library/04 Places/", "\u{1F5FA}\uFE0F", 4],
  ["AI Library/05 Events/", "\u{1F4C5}", 4],
  ["AI Library/06 Doctrines/", "\u{1F4DC}", 4],
  ["AI Library/10 General Conference/", "\u{1F3A4}", 5],
  ["AI Library/65 Secondary Sources/", "\u{1F399}\uFE0F", 5],
  ["AI Library/30 Church History/", "\u{1F3DB}\uFE0F", 5],
  ["AI Library/20 Joseph Smith Papers/", "\u{1F4C4}", 5],
  ["AI Library/50 Questions/", "\u2753", 6],
  ["AI Library/60 Scholarship/", "\u{1F393}", 6],
  ["Library/", "\u270D\uFE0F", 0]
];
function sectionFor(path) {
  for (const [prefix, emoji, rank] of SECTIONS) {
    if (path.startsWith(prefix)) return { emoji, rank };
  }
  return { emoji: "\u{1F517}", rank: 7 };
}
var cache = /* @__PURE__ */ new Map();
function clearConnectionsCache() {
  cache.clear();
}
function connectionsFor(app, chapterPath, slug) {
  const hit = cache.get(chapterPath);
  if (hit && Date.now() - hit.at < 6e4) return hit.conns;
  const byVerse = /* @__PURE__ */ new Map();
  const chapter = [];
  const anchorRe = new RegExp(`#\\^(${slug}-\\d+)$`);
  const chapterBase = chapterPath.split("/").pop().replace(/\.md$/, "");
  const resolved = app.metadataCache.resolvedLinks;
  for (const src of Object.keys(resolved)) {
    if (!resolved[src]?.[chapterPath]) continue;
    if (src === chapterPath) continue;
    if (EXCLUDED_PREFIXES.some((p) => src.startsWith(p))) continue;
    const f = app.vault.getAbstractFileByPath(src);
    if (!(f instanceof import_obsidian8.TFile)) continue;
    if (f.basename === `${chapterBase} - My Notes`) continue;
    const fc = app.metadataCache.getFileCache(f);
    const links = [...fc?.links ?? [], ...fc?.embeds ?? []];
    if (src.startsWith("AI Library/01 Scriptures/Cross References/")) {
      const byLine = /* @__PURE__ */ new Map();
      for (const l of links) {
        const line = l.position?.start?.line ?? -1;
        const arr = byLine.get(line) ?? [];
        arr.push(l);
        byLine.set(line, arr);
      }
      for (const l of links) {
        const m = anchorRe.exec(l.link.trim());
        if (!m) continue;
        const verseId = m[1];
        const mates = byLine.get(l.position?.start?.line ?? -1) ?? [];
        for (const other of mates) {
          const om = /#\^([a-z0-9]+(?:-\d+)+)$/.exec(other.link.trim());
          if (!om || om[1] === verseId) continue;
          const label = other.displayText?.trim() || verseDisplay(om[1]) || other.link;
          const list = byVerse.get(verseId) ?? [];
          if (list.some((c) => c.link === other.link)) continue;
          list.push({
            path: src,
            name: label,
            emoji: "\u{1F4D6}",
            rank: 1,
            link: other.link,
            note: "textual parallel \u2014 tap to read"
          });
          byVerse.set(verseId, list);
        }
      }
      continue;
    }
    const seen = /* @__PURE__ */ new Set();
    for (const l of links) {
      const m = anchorRe.exec(l.link.trim());
      if (!m) continue;
      const verseId = m[1];
      if (seen.has(verseId)) continue;
      seen.add(verseId);
      const { emoji: emoji2, rank: rank2 } = sectionFor(src);
      const list = byVerse.get(verseId) ?? [];
      list.push({ path: src, name: f.basename, emoji: emoji2, rank: rank2 });
      byVerse.set(verseId, list);
    }
    const { emoji, rank } = sectionFor(src);
    chapter.push({ path: src, name: f.basename, emoji, rank });
  }
  for (const list of byVerse.values()) list.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  chapter.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const conns = { byVerse, chapter };
  if (byVerse.size || chapter.length) cache.set(chapterPath, { at: Date.now(), conns });
  return conns;
}
async function snippetFor(app, conn, needle) {
  const f = app.vault.getAbstractFileByPath(conn.path);
  if (!(f instanceof import_obsidian8.TFile)) return null;
  try {
    const text = await app.vault.cachedRead(f);
    const line = text.split("\n").find((ln) => ln.includes(needle));
    if (!line) return null;
    const plain = line.replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2").replace(/<!--[\s\S]*?-->/g, "").replace(/[*_=`>#]|\[!\w+\][+-]?/g, "").replace(/^\s*[-•\d.)\s]+/, "").replace(/\s+/g, " ").trim();
    if (plain.length < 8) return null;
    return plain.length > 200 ? `${plain.slice(0, 197)}\u2026` : plain;
  } catch {
    return null;
  }
}
var ConnectionsModal = class _ConnectionsModal extends import_obsidian8.Modal {
  constructor(s, title, sub, needle, conns, openGraph) {
    super(s.app);
    this.s = s;
    this.title = title;
    this.sub = sub;
    this.needle = needle;
    this.conns = conns;
    this.openGraph = openGraph;
  }
  /** sheet for one verse's citations */
  static forVerse(s, verseId, conns, openGraph) {
    return new _ConnectionsModal(
      s,
      `\u21C4 ${verseDisplay(verseId) ?? verseId}`,
      `${conns.length} page${conns.length === 1 ? "" : "s"} in your library cite this verse`,
      `#^${verseId}`,
      conns,
      openGraph
    );
  }
  /** sheet for everything connected to the whole chapter */
  static forChapter(s, chapterTitle2, conns, openGraph) {
    return new _ConnectionsModal(
      s,
      `\u21C4 ${chapterTitle2}`,
      `${conns.length} page${conns.length === 1 ? "" : "s"} in your library connect to this chapter`,
      `[[${chapterTitle2}`,
      conns,
      openGraph
    );
  }
  onOpen() {
    registerSheet(this);
    const c = this.contentEl;
    this.modalEl.addClass("sg-conn-modal");
    c.addClass("sg-conn");
    c.createEl("h3", { cls: "sg-conn-title", text: this.title });
    c.createDiv({ cls: "sg-conn-sub", text: this.sub });
    const list = c.createDiv({ cls: "sg-conn-list" });
    for (const conn of this.conns.slice(0, 14)) {
      const row = list.createDiv({ cls: "sg-conn-row" });
      const head = row.createDiv({ cls: "sg-conn-row-head" });
      head.createSpan({ cls: "sg-conn-emoji", text: conn.emoji });
      head.createSpan({ cls: "sg-conn-name", text: conn.name });
      if (conn.note) {
        row.createDiv({ cls: "sg-conn-snippet", text: conn.note });
      } else {
        const snip = row.createDiv({ cls: "sg-conn-snippet", text: "\u2026" });
        void snippetFor(this.s.app, conn, this.needle).then((t) => {
          if (t) snip.setText(t);
          else snip.remove();
        });
      }
      row.onclick = () => {
        if (!conn.link) this.close();
        void this.s.app.workspace.openLinkText(conn.link ?? conn.path, "");
      };
    }
    if (this.conns.length > 14) {
      list.createDiv({ cls: "sg-conn-more", text: `\u2026and ${this.conns.length - 14} more in the graph` });
    }
    const foot = c.createEl("button", { cls: "sg-conn-graph", text: "\u{1F578} See the whole connection graph" });
    foot.onclick = () => {
      this.close();
      this.openGraph();
    };
  }
  onClose() {
    unregisterSheet(this);
    this.contentEl.empty();
  }
};

// src/social/readingIntegration.ts
init_studyBar();
init_translations();
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
    const chapterTitle2 = ctx.sourcePath.split("/").pop().replace(/\.md$/, "");
    const conns = connectionsFor(plugin.app, ctx.sourcePath, slug);
    for (const { p, verseId } of paragraphs) {
      const list = conns.byVerse.get(verseId);
      if (!list?.length || p.querySelector(".sg-conn-chip")) continue;
      const chip = p.createSpan({ cls: "sg-conn-chip", text: `\u21C4 ${list.length}` });
      chip.setAttr("aria-label", `${list.length} connected pages`);
      chip.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        ConnectionsModal.forVerse(
          s,
          verseId,
          list,
          () => void openLocalGraphFor(s, chapterTitle2)
        ).open();
      };
    }
    const first = paragraphs.find((x) => x.verseId === `${slug}-1`);
    if (first && conns.chapter.length && !el.querySelector(".sg-chap-conn")) {
      const strip = createDiv({ cls: "sg-chap-conn" });
      strip.createSpan({
        text: `\u21C4 ${conns.chapter.length} page${conns.chapter.length === 1 ? "" : "s"} connect to this chapter`
      });
      strip.onclick = () => {
        ConnectionsModal.forChapter(
          s,
          chapterTitle2,
          conns.chapter,
          () => void openLocalGraphFor(s, chapterTitle2)
        ).open();
      };
      first.p.parentElement?.insertBefore(strip, first.p);
    }
    if (first && !el.querySelector(".sg-voice")) {
      const found = voiceFor(slug);
      if (found) {
        const { v } = found;
        const strip = createDiv({ cls: "sg-voice" });
        const who = strip.createSpan({ cls: "sg-voice-who", text: `\u2712\uFE0F ${v.display ?? v.author}` });
        who.onclick = () => plugin.app.workspace.openLinkText(v.author, ctx.sourcePath);
        const where = strip.createSpan({
          cls: "sg-voice-where",
          text: ` \xB7 ${v.place} \xB7 ${v.era} \u{1F570}`
        });
        where.setAttr("aria-label", "See this moment on the timeline");
        where.onclick = () => {
          const p = plugin;
          const book = slug.replace(/-\d+$/, "");
          void p.openTimelineForBook?.(book);
        };
        strip.createDiv({ cls: "sg-voice-line", text: v.line });
        first.p.parentElement?.insertBefore(strip, first.p);
      }
      const strong = first.p.querySelector("strong");
      let node = strong?.nextSibling ?? null;
      while (node && !(node.nodeType === 3 && node.textContent?.trim())) node = node.nextSibling;
      if (node?.nodeType === 3 && node.textContent) {
        const text = node.textContent;
        const m = /^(\s*)(\S)/.exec(text);
        if (m && /[A-Za-z]/.test(m[2])) {
          const rest = document.createTextNode(text.slice(m[0].length));
          const cap = createSpan({ cls: "sg-dropcap", text: m[2] });
          const lead = document.createTextNode(m[1]);
          const parent = node.parentNode;
          parent.replaceChild(rest, node);
          parent.insertBefore(cap, rest);
          parent.insertBefore(lead, cap);
          first.p.addClass("sg-cap-p");
        }
      }
    }
    void svc.refreshSocial(anchors);
  });
  plugin.registerEvent(plugin.app.metadataCache.on("resolved", () => clearConnectionsCache()));
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
  clone.querySelectorAll(".sgh-note-icon, .sg-badge, .sg-conn-chip").forEach((e) => e.remove());
  const verseText = (clone.textContent ?? "").replace(/^\s*\d+\s*/, "").trim() || null;
  return {
    verseId,
    verseText: verseText ?? "",
    selected: selected && selected.length >= 3 && selected.length <= 600 ? selected : null
  };
}
function buildSelectionMenu(s, svc, hit, openAsk) {
  const menu = new import_obsidian11.Menu();
  menu.addItem((i) => i.setTitle("View notes on this verse").setIcon("sticky-note").onClick(() => new NotesPopover(s, svc, hit.verseId).open()));
  if (isBiblical(hit.verseId)) {
    menu.addItem((i) => i.setTitle("\u{1F310} Other translations").setIcon("languages").onClick(() => new TranslationsModal(s, hit.verseId, hit.verseText).open()));
  }
  menu.addSeparator();
  for (const c of COLORS) {
    menu.addItem((i) => i.setTitle(`Highlight ${c}`).setIcon("highlighter").onClick((e) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addHighlight(hit.verseId, c, hit.verseText, hit.selected, vis, gid);
        new import_obsidian11.Notice(`Highlighted \u2014 ${label}`);
      }).showAtMouseEvent(e);
    }));
  }
  menu.addSeparator();
  menu.addItem((i) => i.setTitle("Add note\u2026").setIcon("pencil").onClick(() => {
    new NoteModal(s, hit.verseId, (text) => {
      svc.visibilityMenu((vis, gid, label) => {
        void svc.addNote(hit.verseId, text, hit.selected, vis, gid);
        new import_obsidian11.Notice(`Note saved \u2014 ${label}`);
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
var import_obsidian12 = require("obsidian");
var WelcomeModal = class extends import_obsidian12.Modal {
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
    new import_obsidian12.Setting(contentEl).setName("Your name").addText((t) => t.setPlaceholder("e.g. Mom").onChange((v) => name = v));
    new import_obsidian12.Setting(contentEl).setName("Invite code").setDesc("From the family member who runs Scripture Graph").addText((t) => t.setPlaceholder("XXXX-XXXX-XXXX").onChange((v) => invite = v));
    new import_obsidian12.Setting(contentEl).setName("This device").addText((t) => t.setValue(device).onChange((v) => device = v || "My device"));
    new import_obsidian12.Setting(contentEl).addButton((b) => b.setButtonText("Join").setCta().onClick(async () => {
      const code = invite.trim();
      if (!code) return void new import_obsidian12.Notice("Invite code required");
      if (code.startsWith("sgd_")) {
        try {
          this.s.device.deviceToken = code;
          await this.s.saveDevice();
          const me = await this.s.api.me();
          this.s.device.userId = me.user.user_id;
          this.s.device.displayName = me.user.display_name;
          await this.s.saveDevice();
          await refreshIdentity(this.s);
          new import_obsidian12.Notice(`Welcome, ${me.user.display_name}!`);
          this.close();
          this.maybeOfferAi();
        } catch (e) {
          this.s.device.deviceToken = null;
          await this.s.saveDevice();
          new import_obsidian12.Notice(`Token rejected: ${e.message}`);
        }
        return;
      }
      if (!name.trim()) return void new import_obsidian12.Notice("Name and invite code required");
      try {
        const session = await this.s.api.claim(code, name.trim(), device);
        this.s.device.deviceToken = session.token;
        this.s.device.userId = session.user.user_id;
        this.s.device.displayName = session.user.display_name;
        await this.s.saveDevice();
        await refreshIdentity(this.s);
        new import_obsidian12.Notice(`Welcome, ${session.user.display_name}!`);
        this.close();
        this.maybeOfferAi();
      } catch (e) {
        try {
          const session = await linkDevice(this.s, invite.trim(), device);
          new import_obsidian12.Notice(`Welcome back, ${session.display_name}!`);
          this.close();
          this.maybeOfferAi();
        } catch {
          new import_obsidian12.Notice(`Could not join: ${e.message}`);
        }
      }
    })).addButton((b) => b.setButtonText("Maybe later").onClick(() => this.close()));
  }
  maybeOfferAi() {
    const m = new import_obsidian12.Modal(this.app);
    m.contentEl.createEl("h3", { text: "Want AI features?" });
    m.contentEl.createEl("p", {
      text: "Ask questions about any verse using YOUR OWN AI balance (about $10 goes far). Everything else works without it."
    });
    new import_obsidian12.Setting(m.contentEl).addButton((b) => b.setButtonText("Connect AI").setCta().onClick(async () => {
      m.close();
      await this.ai.beginConnect();
      new import_obsidian12.Notice("Complete the authorization in your browser \u2014 Obsidian will catch the redirect.");
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
var import_obsidian13 = require("obsidian");
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
    new import_obsidian13.Notice("AI connected \u2713 (your own OpenRouter wallet)");
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
var import_obsidian14 = require("obsidian");

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
    const cache2 = s.app.metadataCache.getFileCache(f);
    const aliases = cache2?.frontmatter?.["aliases"] ?? [];
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
var AskView = class extends import_obsidian14.ItemView {
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
    await import_obsidian14.MarkdownRenderer.render(this.app, text, el, "", this);
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
      new import_obsidian14.Notice("Saved to Library/AI Notes");
    } catch (e) {
      new import_obsidian14.Notice(`Could not save: ${e.message}`);
    }
  }
};

// src/reader/readerView.ts
var import_obsidian15 = require("obsidian");
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
var ReaderView = class extends import_obsidian15.ItemView {
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
          await import_obsidian15.MarkdownRenderer.render(
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
var import_obsidian16 = require("obsidian");
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
    if (this.trail.length < 2) return void new import_obsidian16.Notice("Trail is empty \u2014 study a little first");
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
      new import_obsidian16.Notice("Trail saved to Library/Study Trails");
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
    new import_obsidian16.Notice(`Bookmarked ${f.basename}`);
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
      new import_obsidian16.Notice("You already have this flashcard \u{1F0CF}");
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
    new import_obsidian16.Notice("Flashcard added \u{1F0CF}");
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
    if (!due.length) return void new import_obsidian16.Notice("No cards due \u2014 well done!");
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
var NameModal = class extends import_obsidian16.Modal {
  constructor(s, initial, onSubmit) {
    super(s.app);
    this.initial = initial;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    this.contentEl.createEl("h3", { text: "Save study trail" });
    let v = this.initial;
    new import_obsidian16.Setting(this.contentEl).setName("Name").addText((t) => t.setValue(this.initial).onChange((x) => v = x));
    new import_obsidian16.Setting(this.contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(() => {
      this.close();
      this.onSubmit(v || this.initial);
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ReviewModal = class extends import_obsidian16.Modal {
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

// src/study/scenes.ts
var SCENES = [
  { id: "sunrise", name: "Sunrise", emoji: "\u{1F305}", hours: [[5, 10]], layers: 6 },
  { id: "waters", name: "Still Waters", emoji: "\u{1F30A}", hours: [[10, 16]], layers: 8 },
  { id: "mount", name: "The Mount", emoji: "\u26F0\uFE0F", hours: [], layers: 6 },
  { id: "garden", name: "The Garden", emoji: "\u{1F33F}", hours: [], layers: 5 },
  { id: "fields", name: "The Fields", emoji: "\u{1F33E}", hours: [], layers: 6 },
  { id: "storm", name: "The Storm", emoji: "\u26C8\uFE0F", hours: [], layers: 7 },
  { id: "temple", name: "The Temple", emoji: "\u{1F3DB}\uFE0F", hours: [], layers: 5 },
  { id: "city", name: "The City", emoji: "\u{1F3D9}\uFE0F", hours: [[16, 20]], layers: 6 },
  { id: "warcamp", name: "The War Camp", emoji: "\u2694\uFE0F", hours: [], layers: 5 },
  { id: "prison", name: "The Prison", emoji: "\u26D3\uFE0F", hours: [], layers: 5 },
  { id: "desert", name: "Desert Dusk", emoji: "\u{1F3DC}\uFE0F", hours: [], layers: 6 },
  { id: "starlight", name: "The Heavens", emoji: "\u{1F30C}", hours: [[20, 24], [0, 5]], layers: 5 },
  { id: "candle", name: "Candlelight", emoji: "\u{1F56F}\uFE0F", hours: [], layers: 4 }
];
var ROOT_CLS = "sg-scene";
function lcg(seed) {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
}
var svgUrl = (w, h, inner, preserve = false) => `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'${preserve ? "" : " preserveAspectRatio='none'"}>${inner}</svg>`
)}")`;
function seededStars(seed, n, w, h, rMin, rMax, color) {
  const rnd = lcg(seed);
  let c = "";
  for (let i = 0; i < n; i++) {
    c += `<circle cx='${(rnd() * w).toFixed(1)}' cy='${(rnd() * h).toFixed(1)}' r='${(rMin + rnd() * (rMax - rMin)).toFixed(2)}' fill='${color}' opacity='${(0.4 + rnd() * 0.6).toFixed(2)}'/>`;
  }
  return svgUrl(w, h, c, true);
}
function ridge(seed, color, base, jag, crest) {
  const rnd = lcg(seed);
  let d = `M0 ${base}`;
  let y = base;
  for (let x = 0; x <= 900; x += 45) {
    y = Math.max(20, Math.min(190, y + (rnd() - 0.5) * 2 * jag));
    d += ` L${x} ${y.toFixed(0)}`;
  }
  const open2 = d;
  d += " L900 200 L0 200 Z";
  let c = `<path d='${d}' fill='${color}'/>`;
  if (crest) c += `<path d='${open2}' stroke='${crest}' stroke-width='2.2' fill='none' opacity='0.55'/>`;
  return svgUrl(900, 200, c);
}
function hills(color, amp, phase, crest) {
  const top = `M0 ${120 + phase} Q 150 ${120 - amp + phase} 300 ${125 + phase} T 600 ${118 + phase} T 900 ${128 + phase}`;
  let c = `<path d='${top} L 900 200 L 0 200 Z' fill='${color}'/>`;
  if (crest) c += `<path d='${top}' stroke='${crest}' stroke-width='2.6' fill='none' opacity='0.5'/>`;
  return svgUrl(900, 200, c);
}
function reeds(seed, color) {
  const rnd = lcg(seed);
  let c = "";
  const stem3 = (x, h, lean, head) => {
    const hx = (x + lean).toFixed(0), hy = (200 - h).toFixed(0);
    let s = `<path d='M${x.toFixed(0)} 202 Q ${(x + lean * 0.35).toFixed(0)} ${(200 - h * 0.6).toFixed(0)} ${hx} ${hy}' stroke='${color}' stroke-width='3' fill='none'/>`;
    if (head) {
      s += `<rect x='${(x + lean - 4).toFixed(0)}' y='${hy}' width='8' height='26' rx='4' fill='${color}' transform='rotate(${(lean * 0.8).toFixed(0)} ${hx} ${hy})'/>`;
    }
    return s;
  };
  for (let i = 0; i < 14; i++) {
    c += stem3(10 + rnd() * 250, 90 + rnd() * 85, (rnd() - 0.5) * 44, rnd() > 0.35);
  }
  for (let i = 0; i < 5; i++) {
    c += stem3(760 + rnd() * 130, 70 + rnd() * 70, (rnd() - 0.5) * 40, rnd() > 0.45);
  }
  return svgUrl(900, 200, c);
}
function clouds(seed, color) {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='0' width='900' height='30' fill='${color}'/>`;
  for (let i = 0; i < 13; i++) {
    const x = i * 72 + rnd() * 36;
    const depth = 24 + rnd() * 74;
    for (let j = 0; j < 5; j++) {
      c += `<ellipse cx='${(x + (rnd() - 0.5) * 90).toFixed(0)}' cy='${(rnd() * depth).toFixed(0)}' rx='${(42 + rnd() * 52).toFixed(0)}' ry='${(18 + rnd() * 20).toFixed(0)}' fill='${color}'/>`;
    }
  }
  return svgUrl(900, 200, c);
}
function bolt(seed, color) {
  const rnd = lcg(seed);
  const walk = (x0, y0, yEnd, drift) => {
    let d = `M${x0.toFixed(0)} ${y0.toFixed(0)}`;
    let x = x0;
    for (let y = y0; y < yEnd; y += 34 + rnd() * 22) {
      x += (rnd() - 0.5) * drift;
      d += ` L${x.toFixed(0)} ${Math.min(y, yEnd).toFixed(0)}`;
    }
    return d;
  };
  return svgUrl(
    300,
    420,
    `<path d='${walk(150, 0, 340, 74)}' stroke='${color}' stroke-width='3.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/><path d='${walk(150 + (rnd() - 0.5) * 30, 120, 265, 88)}' stroke='${color}' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round' opacity='0.8'/>`,
    true
  );
}
function galaxy(seed) {
  const rnd = lcg(seed);
  let c = "";
  const px = (t) => t * 1600;
  const py = (t) => 640 - t * 380;
  for (let i = 0; i < 4; i++) {
    const t = 0.12 + i * 0.24;
    const hue = ["#b78cff", "#7fd4d4", "#ff9ad5", "#9fb4ff"][i];
    c += `<ellipse cx='${px(t).toFixed(0)}' cy='${py(t).toFixed(0)}' rx='${(220 + rnd() * 140).toFixed(0)}' ry='${(80 + rnd() * 60).toFixed(0)}' fill='${hue}' opacity='0.055' transform='rotate(-13 ${px(t).toFixed(0)} ${py(t).toFixed(0)})'/>`;
  }
  for (let i = 0; i < 3; i++) {
    const t = 0.2 + i * 0.28;
    c += `<ellipse cx='${px(t).toFixed(0)}' cy='${(py(t) + 14).toFixed(0)}' rx='${(200 + rnd() * 120).toFixed(0)}' ry='${(26 + rnd() * 22).toFixed(0)}' fill='#070919' opacity='0.4' transform='rotate(-13 ${px(t).toFixed(0)} ${py(t).toFixed(0)})'/>`;
  }
  for (let i = 0; i < 560; i++) {
    const t = rnd();
    const spread = (rnd() + rnd() - 1) * 130;
    const shade = rnd();
    const fill = shade > 0.85 ? "#ffd9c4" : shade > 0.5 ? "#cdd6ff" : "#ffffff";
    c += `<circle cx='${(px(t) + (rnd() - 0.5) * 40).toFixed(0)}' cy='${(py(t) + spread).toFixed(0)}' r='${(0.5 + rnd() * 1.1).toFixed(2)}' fill='${fill}' opacity='${(0.25 + rnd() * 0.7).toFixed(2)}'/>`;
  }
  return svgUrl(1600, 900, c, true);
}
function skyline(seed, color) {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='150' width='900' height='50' fill='${color}'/>`;
  let x = 0;
  while (x < 900) {
    const w = 30 + rnd() * 70;
    const h = 30 + rnd() * 75;
    c += `<rect x='${x.toFixed(0)}' y='${(150 - h).toFixed(0)}' width='${w.toFixed(0)}' height='${(h + 50).toFixed(0)}' fill='${color}'/>`;
    if (rnd() > 0.65) {
      c += `<ellipse cx='${(x + w / 2).toFixed(0)}' cy='${(150 - h).toFixed(0)}' rx='${(w / 2.4).toFixed(0)}' ry='${(w / 3.2).toFixed(0)}' fill='${color}'/>`;
    }
    x += w + 8 + rnd() * 30;
  }
  return svgUrl(900, 200, c);
}
function facade(color, door) {
  let c = `<rect x='120' y='188' width='660' height='12' fill='${color}'/><rect x='145' y='178' width='610' height='10' fill='${color}'/><rect x='160' y='76' width='580' height='18' fill='${color}'/><path d='M148 74 L752 74 L450 16 Z' fill='${color}'/>`;
  for (let x = 185; x <= 665; x += 80) {
    c += `<rect x='${x}' y='100' width='22' height='78' rx='3' fill='${color}'/><rect x='${x - 5}' y='94' width='32' height='8' fill='${color}'/>`;
  }
  if (door) {
    c = `<defs><radialGradient id='dg' cx='0.5' cy='0.7' r='0.5'><stop offset='0%' stop-color='${door}' stop-opacity='0.55'/><stop offset='100%' stop-color='${door}' stop-opacity='0'/></radialGradient></defs>` + c + `<ellipse cx='450' cy='152' rx='96' ry='64' fill='url(#dg)'/><path d='M426 178 L426 140 Q450 118 474 140 L474 178 Z' fill='${door}' opacity='0.9'/>`;
  }
  return svgUrl(900, 200, c);
}
function wheat(seed, color, n) {
  const rnd = lcg(seed);
  let c = "";
  for (let i = 0; i < n; i++) {
    const x = rnd() * 900;
    const h = 82 + rnd() * 70;
    const lean = (rnd() - 0.5) * 56;
    const hx = (x + lean).toFixed(0), hy = (200 - h).toFixed(0);
    const tilt = (lean * 1.1).toFixed(0);
    c += `<path d='M${x.toFixed(0)} 202 Q ${(x + lean * 0.3).toFixed(0)} ${(200 - h * 0.55).toFixed(0)} ${hx} ${hy}' stroke='${color}' stroke-width='2.8' fill='none'/><ellipse cx='${hx}' cy='${hy}' rx='4.6' ry='13' fill='${color}' transform='rotate(${tilt} ${hx} ${hy})'/>`;
    for (let a = -1; a <= 1; a++) {
      c += `<path d='M${hx} ${(200 - h - 6).toFixed(0)} l ${(a * 6 + lean * 0.2).toFixed(0)} -13' stroke='${color}' stroke-width='1.1' fill='none' transform='rotate(${tilt} ${hx} ${hy})'/>`;
    }
  }
  return svgUrl(900, 200, c);
}
function canopy(seed, color) {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='0' width='900' height='24' fill='${color}'/>`;
  for (let i = 0; i < 15; i++) {
    const x = i * 62 + rnd() * 30;
    const depth = 26 + rnd() * 92;
    for (let j = 0; j < 6; j++) {
      c += `<ellipse cx='${(x + (rnd() - 0.5) * 74).toFixed(0)}' cy='${(rnd() * depth).toFixed(0)}' rx='${(22 + rnd() * 28).toFixed(0)}' ry='${(15 + rnd() * 19).toFixed(0)}' fill='${color}'/>`;
    }
  }
  for (let b = 0; b < 3; b++) {
    const bx = 90 + rnd() * 700;
    const sway = (rnd() * 60 - 30).toFixed(0);
    c += `<path d='M${bx.toFixed(0)} 0 q ${(rnd() * 36 - 18).toFixed(0)} 80 ${sway} 148' stroke='${color}' stroke-width='4.5' fill='none'/><ellipse cx='${(bx + Number(sway)).toFixed(0)}' cy='150' rx='16' ry='11' fill='${color}'/>`;
  }
  return svgUrl(900, 200, c);
}
function bird(color) {
  return svgUrl(
    26,
    12,
    `<path d='M1 9 Q 7 1 13 9 Q 19 1 25 9' stroke='${color}' stroke-width='1.6' fill='none' stroke-linecap='round'/>`,
    true
  );
}
function tents(seed, color) {
  const rnd = lcg(seed);
  let c = `<rect x='0' y='186' width='900' height='14' fill='${color}'/>`;
  let x = -20;
  let i = 0;
  while (x < 900) {
    const w = 64 + rnd() * 58;
    const h = 42 + rnd() * 34;
    c += `<path d='M${x.toFixed(0)} 188 L${(x + w / 2).toFixed(0)} ${(188 - h).toFixed(0)} L${(x + w).toFixed(0)} 188 Z' fill='${color}'/>`;
    if (i % 3 === 2) {
      const px = x + w + 6 + rnd() * 8;
      const ph = 92 + rnd() * 30;
      c += `<rect x='${px.toFixed(0)}' y='${(188 - ph).toFixed(0)}' width='3.4' height='${ph.toFixed(0)}' fill='${color}'/><path d='M${(px + 3).toFixed(0)} ${(188 - ph).toFixed(0)} l 26 7 l -26 8 Z' fill='${color}'/>`;
    }
    x += w + 14 + rnd() * 26;
    i += 1;
  }
  return svgUrl(900, 200, c);
}
function banner(pole, cloth) {
  return svgUrl(
    300,
    420,
    `<rect x='146' y='36' width='7' height='384' rx='3' fill='${pole}'/><circle cx='149' cy='32' r='7' fill='${pole}'/><path d='M154 44 Q 220 30 290 52 Q 252 74 214 78 Q 254 92 284 112 Q 214 118 154 104 Z' fill='${cloth}'/>`,
    true
  );
}
function stones(seed, color) {
  const rnd = lcg(seed);
  let c = "";
  for (let y = 0; y <= 600; y += 52) {
    const jy = y + (rnd() - 0.5) * 5;
    c += `<path d='M0 ${jy.toFixed(0)} L900 ${(jy + (rnd() - 0.5) * 7).toFixed(0)}' stroke='${color}' stroke-width='2' fill='none' opacity='0.55'/>`;
    const off = rnd() * 90;
    for (let x = off; x < 900; x += 105 + rnd() * 60) {
      c += `<path d='M${x.toFixed(0)} ${jy.toFixed(0)} L${(x + (rnd() - 0.5) * 6).toFixed(0)} ${(jy + 52).toFixed(0)}' stroke='${color}' stroke-width='2' fill='none' opacity='0.4'/>`;
    }
  }
  return svgUrl(900, 600, c);
}
function cellWindow(bar, glow) {
  return svgUrl(
    200,
    250,
    `<defs><radialGradient id='wg' cx='0.5' cy='0.45' r='0.75'><stop offset='0%' stop-color='${glow}' stop-opacity='0.95'/><stop offset='60%' stop-color='${glow}' stop-opacity='0.35'/><stop offset='100%' stop-color='${glow}' stop-opacity='0'/></radialGradient></defs><path d='M40 250 L40 96 Q 100 30 160 96 L160 250 Z' fill='url(#wg)'/><rect x='62' y='64' width='9' height='186' fill='${bar}'/><rect x='96' y='46' width='9' height='204' fill='${bar}'/><rect x='130' y='64' width='9' height='186' fill='${bar}'/><rect x='30' y='240' width='140' height='10' fill='${bar}'/>`,
    true
  );
}
function particles(el, cls, n, seed, style) {
  const rnd = lcg(seed);
  for (let i = 0; i < n; i++) style(rnd, el.createDiv({ cls: `sgp ${cls}` }), i);
}
var SceneManager = class {
  el = null;
  currentId = null;
  apply(id) {
    const target = id === "auto" ? this.autoPick() : id;
    if (!target || target === "none") {
      this.el?.remove();
      this.el = null;
      this.currentId = null;
      document.body.removeClass("sg-scene-on");
      delete document.body.dataset["sgScene"];
      return;
    }
    if (this.currentId === target && this.el) return;
    this.el?.remove();
    const scene = SCENES.find((s) => s.id === target) ?? SCENES[0];
    const el = document.body.createDiv({ cls: `${ROOT_CLS} ${ROOT_CLS}-${scene.id}` });
    document.body.insertBefore(el, document.body.firstChild);
    for (let i = 1; i <= scene.layers; i++) el.createDiv({ cls: `sgl sgl-${i}` });
    el.createDiv({ cls: "sgl sgl-scrim" });
    this.decorate(scene.id, el);
    this.el = el;
    this.currentId = scene.id;
    document.body.addClass("sg-scene-on");
    document.body.dataset["sgScene"] = scene.id;
  }
  current() {
    return this.currentId;
  }
  autoPick() {
    const h = (/* @__PURE__ */ new Date()).getHours();
    for (const s of SCENES) {
      if (s.hours.some(([a, b]) => h >= a && h < b)) return s.id;
    }
    return "starlight";
  }
  bg(el, layer, image) {
    const l = el.querySelector(`.sgl-${layer}`);
    if (l) l.style.backgroundImage = image;
  }
  decorate(id, el) {
    if (id === "starlight") {
      this.bg(el, 2, seededStars(7, 150, 1200, 900, 0.6, 1.4, "#ffffff"));
      this.bg(el, 3, seededStars(23, 95, 1100, 800, 0.9, 2, "#cdd6ff"));
      this.bg(el, 4, galaxy(67));
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-a" });
      el.createDiv({ cls: "sgp sg-shoot sg-shoot-b" });
    }
    if (id === "warcamp") {
      this.bg(el, 2, ridge(83, "#120e1a", 120, 30));
      this.bg(el, 4, tents(91, "#0c0912"));
      this.bg(el, 5, banner("#0a0810", "#8a2f2a"));
      particles(el, "sg-ember", 9, 157, (rnd, p) => {
        const fire = [21, 52, 79][Math.floor(rnd() * 3)];
        p.style.left = `${fire + (rnd() - 0.5) * 7}%`;
        p.style.bottom = "9%";
        p.style.animationDuration = `${6 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 10}s`;
        p.style.width = p.style.height = `${1.5 + rnd() * 2.5}px`;
      });
      particles(el, "sg-incense", 3, 163, (rnd, p) => {
        p.style.left = `${[20, 51, 78][Math.floor(rnd() * 3)] + (rnd() - 0.5) * 4}%`;
        p.style.bottom = "12%";
        p.style.animationDuration = `${15 + rnd() * 10}s`;
        p.style.animationDelay = `${-rnd() * 18}s`;
      });
    }
    if (id === "prison") {
      this.bg(el, 2, stones(43, "#25242c"));
      this.bg(el, 4, cellWindow("#08070b", "#ffe3ac"));
      particles(el, "sg-mote", 6, 173, (rnd, p) => {
        const t = rnd();
        p.style.left = `${74 - 38 * t + (rnd() - 0.5) * 6}%`;
        p.style.top = `${8 + 78 * t + (rnd() - 0.5) * 5}%`;
        p.style.bottom = "auto";
        p.style.animationDuration = `${10 + rnd() * 8}s, ${5 + rnd() * 4}s`;
        p.style.animationDelay = `${-rnd() * 12}s, ${-rnd() * 5}s`;
      });
    }
    if (id === "desert") {
      this.bg(el, 2, hills("#2a1c2e", 30, -12));
      this.bg(el, 3, hills("#140d18", 45, 18));
      this.bg(el, 4, seededStars(41, 45, 1200, 500, 0.5, 1.2, "#ffe9c9"));
      particles(el, "sg-sand", 5, 61, (rnd, p) => {
        p.style.top = `${55 + rnd() * 30}%`;
        p.style.animationDuration = `${18 + rnd() * 14}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
        p.style.opacity = `${0.05 + rnd() * 0.08}`;
      });
    }
    if (id === "sunrise") {
      this.bg(el, 5, ridge(17, "#241a33", 120, 26));
      const rnd = lcg(11);
      for (let i = 0; i < 3; i++) {
        const b = el.createDiv({ cls: "sgp sg-bird" });
        b.style.backgroundImage = bird("#2c2136");
        b.style.top = `${12 + rnd() * 22}%`;
        b.style.animationDuration = `${34 + rnd() * 22}s`;
        b.style.animationDelay = `${-rnd() * 40}s`;
        b.style.transform = `scale(${0.7 + rnd() * 0.7})`;
      }
    }
    if (id === "waters") {
      const clip = el.createDiv({ cls: "sg-water-clip" });
      el.insertBefore(clip, el.querySelector(".sgl-5"));
      for (const n of [2, 3, 4]) {
        const ring = el.querySelector(`.sgl-${n}`);
        if (ring) clip.appendChild(ring);
      }
      this.bg(el, 7, hills("#04121c", 16, 55));
      this.bg(el, 8, reeds(73, "#031017"));
      particles(el, "sg-mote", 7, 91, (rnd, p) => {
        p.style.left = `${8 + rnd() * 84}%`;
        p.style.bottom = `${8 + rnd() * 40}%`;
        p.style.animationDuration = `${9 + rnd() * 8}s, ${5 + rnd() * 4}s`;
        p.style.animationDelay = `${-rnd() * 12}s, ${-rnd() * 5}s`;
      });
    }
    if (id === "candle") {
      particles(el, "sg-ember", 8, 133, (rnd, p) => {
        p.style.left = `${38 + rnd() * 24}%`;
        p.style.animationDuration = `${7 + rnd() * 7}s`;
        p.style.animationDelay = `${-rnd() * 12}s`;
        p.style.width = p.style.height = `${2 + rnd() * 3}px`;
      });
    }
    if (id === "mount") {
      this.bg(el, 2, ridge(5, "#2c3350", 100, 34, "#8fa3d6"));
      this.bg(el, 3, ridge(29, "#1d2338", 130, 42, "#5a6a97"));
      this.bg(el, 4, ridge(53, "#10131f", 160, 48));
      const b = el.createDiv({ cls: "sgp sg-bird" });
      b.style.backgroundImage = bird("#0e1220");
      b.style.top = "9%";
      b.style.animationDuration = "58s";
      b.style.animationDelay = "-20s";
      b.style.transform = "scale(0.8)";
      particles(el, "sg-mist", 4, 71, (rnd, p) => {
        p.style.top = `${34 + rnd() * 38}%`;
        p.style.animationDuration = `${34 + rnd() * 30}s`;
        p.style.animationDelay = `${-rnd() * 40}s`;
        p.style.height = `${40 + rnd() * 60}px`;
        p.style.opacity = `${0.1 + rnd() * 0.14}`;
      });
    }
    if (id === "garden") {
      this.bg(el, 3, canopy(11, "#0e2f1a"));
      this.bg(el, 4, canopy(41, "#081f10"));
      this.bg(el, 5, hills("#0a2413", 30, 45));
      particles(el, "sg-dapple", 5, 83, (rnd, p) => {
        p.style.left = `${rnd() * 90}%`;
        p.style.top = `${rnd() * 70}%`;
        p.style.width = p.style.height = `${90 + rnd() * 160}px`;
        p.style.animationDuration = `${12 + rnd() * 14}s`;
        p.style.animationDelay = `${-rnd() * 18}s`;
      });
      particles(el, "sg-firefly", 6, 97, (rnd, p) => {
        p.style.left = `${5 + rnd() * 90}%`;
        p.style.top = `${30 + rnd() * 60}%`;
        p.style.animationDuration = `${7 + rnd() * 8}s, ${3 + rnd() * 3}s`;
        p.style.animationDelay = `${-rnd() * 10}s, ${-rnd() * 3}s`;
      });
      particles(el, "sg-petal", 5, 103, (rnd, p) => {
        p.style.left = `${rnd() * 94}%`;
        p.style.animationDuration = `${14 + rnd() * 10}s, ${4 + rnd() * 3}s`;
        p.style.animationDelay = `${-rnd() * 20}s, ${-rnd() * 4}s`;
        p.style.transform = `scale(${0.7 + rnd() * 0.6})`;
      });
      particles(el, "sg-blossom", 7, 109, (rnd, p) => {
        p.style.left = `${rnd() * 96}%`;
        p.style.top = `${1 + rnd() * 12}%`;
        p.style.animationDuration = `${5 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 8}s`;
      });
    }
    if (id === "fields") {
      this.bg(el, 3, hills("#6d4a1f", 24, 30));
      this.bg(el, 4, wheat(37, "#8a6226", 70));
      this.bg(el, 5, wheat(59, "#553b14", 55));
      particles(el, "sg-chaff", 5, 113, (rnd, p) => {
        p.style.left = `${rnd() * 95}%`;
        p.style.bottom = `${6 + rnd() * 26}%`;
        p.style.animationDuration = `${11 + rnd() * 9}s`;
        p.style.animationDelay = `${-rnd() * 14}s`;
      });
    }
    if (id === "storm") {
      this.bg(el, 5, hills("#0a1420", 55, 30, "#7d99b8"));
      this.bg(el, 6, hills("#050b13", 70, 60, "#5c7896"));
      this.bg(el, 7, clouds(31, "#0b1019"));
      const lit = el.createDiv({ cls: "sgp sg-cloudlit" });
      lit.style.backgroundImage = clouds(31, "#93aed0");
      const bt = el.createDiv({ cls: "sgp sg-bolt" });
      bt.style.backgroundImage = bolt(101, "#eaf2ff");
      el.createDiv({ cls: "sgp sg-flash" });
      particles(el, "sg-cloudmass", 3, 127, (rnd, p) => {
        p.style.top = `${-6 + rnd() * 18}%`;
        p.style.left = `${-10 + rnd() * 80}%`;
        p.style.animationDuration = `${26 + rnd() * 22}s`;
        p.style.animationDelay = `${-rnd() * 30}s`;
      });
    }
    if (id === "temple") {
      this.bg(el, 2, seededStars(83, 60, 1200, 420, 0.5, 1.3, "#ffe9c9"));
      this.bg(el, 4, facade("#1c1207", "#ffc879"));
      this.bg(el, 5, hills("#0d0805", 16, 80));
      particles(el, "sg-incense", 5, 139, (rnd, p) => {
        p.style.left = `${22 + rnd() * 56}%`;
        p.style.animationDuration = `${16 + rnd() * 12}s`;
        p.style.animationDelay = `${-rnd() * 20}s`;
      });
      particles(el, "sg-ember sg-spark", 6, 149, (rnd, p) => {
        p.style.left = `${44 + rnd() * 12}%`;
        p.style.animationDuration = `${6 + rnd() * 6}s`;
        p.style.animationDelay = `${-rnd() * 10}s`;
        p.style.width = p.style.height = `${1.5 + rnd() * 2.5}px`;
      });
    }
    if (id === "city") {
      this.bg(el, 3, skyline(19, "#191223"));
      this.bg(el, 4, skyline(47, "#0d0a15"));
      particles(el, "sg-window", 9, 151, (rnd, p) => {
        p.style.left = `${3 + rnd() * 92}%`;
        p.style.bottom = `${6 + rnd() * 16}%`;
        p.style.animationDuration = `${3 + rnd() * 5}s`;
        p.style.animationDelay = `${-rnd() * 6}s`;
      });
    }
  }
};

// src/main.ts
var import_obsidian20 = require("obsidian");

// src/settings.ts
var import_obsidian17 = require("obsidian");
init_src();
var SGSettingsTab = class extends import_obsidian17.PluginSettingTab {
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
      new import_obsidian17.Setting(el).setName("Join Scripture Graph").setDesc("Sign in with your family invite code").addButton((b) => b.setButtonText("Join\u2026").setCta().onClick(() => new WelcomeModal(s, this.p.ai, () => this.display()).open()));
    } else {
      new import_obsidian17.Setting(el).setName(`Signed in as ${s.device.displayName ?? "?"}`).setDesc(`Groups: ${s.groups.map((g) => g.name).join(", ") || "none yet"}`).addButton((b) => b.setButtonText("Sign out this device").onClick(async () => {
        try {
          await s.api.logoutDevice();
        } catch {
        }
        s.device.deviceToken = null;
        s.device.userId = null;
        await s.saveDevice();
        this.display();
      }));
      new import_obsidian17.Setting(el).setName("Link another device").setDesc("Creates a one-time code (valid 1 hour) to sign THIS account in on your phone").addButton((b) => b.setButtonText("Create code").onClick(async () => {
        try {
          const inv = await s.api.createAccountInviteDeviceLink();
          new CodeModal(
            this.p,
            "Device link code",
            inv.code,
            "On the other device: Settings \u2192 Scripture Graph \u2192 Join \u2192 paste this code."
          ).open();
        } catch (e) {
          new import_obsidian17.Notice(e.message);
        }
      }));
      new import_obsidian17.Setting(el).setName("Create a group").addText((t) => t.setPlaceholder("e.g. Richins Family").then((t2) => {
        new import_obsidian17.Setting(el).addButton((b) => b.setButtonText("Create").onClick(async () => {
          const name = t2.getValue().trim();
          if (!name) return;
          await s.api.createGroup(name);
          await refreshIdentity(s);
          new import_obsidian17.Notice(`Group \u201C${name}\u201D created`);
          this.display();
        }));
      }));
      for (const g of s.groups) {
        new import_obsidian17.Setting(el).setName(`\u{1F465} ${g.name}`).setDesc(g.role).addButton((b) => b.setButtonText("Invite\u2026").onClick(async () => {
          try {
            const inv = await s.api.createGroupInvite(g.group_id);
            new CodeModal(
              this.p,
              `Invite to ${g.name}`,
              inv.code,
              "Share this code \u2014 it works for existing members via \u201CJoin group\u201D, and the owner can bundle it into account invites."
            ).open();
          } catch (e) {
            new import_obsidian17.Notice(e.message);
          }
        })).addButton((b) => b.setButtonText("Leave").setWarning().onClick(async () => {
          await s.api.leaveGroup(g.group_id);
          await refreshIdentity(s);
          this.display();
        }));
      }
      new import_obsidian17.Setting(el).setName("Join a group").setDesc("Paste a group invite code").addText((t) => t.setPlaceholder("XXXX-XXXX-XXXX").then((t2) => {
        new import_obsidian17.Setting(el).addButton((b) => b.setButtonText("Join group").onClick(async () => {
          try {
            const r = await s.api.acceptInvite(t2.getValue().trim());
            await refreshIdentity(s);
            new import_obsidian17.Notice(`Joined ${r.group_name ?? "group"}`);
            this.display();
          } catch (e) {
            new import_obsidian17.Notice(e.message);
          }
        }));
      }));
    }
    el.createEl("h2", { text: "Reading" });
    new import_obsidian17.Setting(el).setName("Chapter links open My Study page").setDesc("Links like [[Matthew 5]] land on your editable page (the scripture is embedded there). Verse-precise links still open the exact verse.").addToggle((t) => t.setValue(s.settings.chapterLinksToMyStudy).onChange(async (v) => {
      s.applySettings({ chapterLinksToMyStudy: v });
      await this.p.saveSharedSettings();
    }));
    new import_obsidian17.Setting(el).setName("Show AI Library folder in sidebar").setDesc("Off keeps the AI Library out of the file explorer on this device \u2014 study pages still show and link its content (read-only). Leave off on family devices.").addToggle((t) => t.setValue(s.device.showAiLibrary).onChange(async (v) => {
      s.device.showAiLibrary = v;
      document.body.toggleClass("sg-hide-ai-lib", !v);
      await s.saveDevice();
    }));
    new import_obsidian17.Setting(el).setName("Swipe to turn the chapter").setDesc("On the phone, a firm left/right swipe on a reading page moves one chapter (Obsidian's sidebar swipes step aside there). Turn off to give reading pages back to the sidebars.").addToggle((t) => t.setValue(s.device.swipeNav !== false).onChange(async (v) => {
      s.device.swipeNav = v;
      if (!v) {
        for (const leaf of s.app.workspace.getLeavesOfType("markdown")) {
          const ce = leaf.view.contentEl;
          if (ce) delete ce.dataset.ignoreSwipe;
        }
      }
      await s.saveDevice();
    }));
    new import_obsidian17.Setting(el).setName("Reading scene").setDesc("An ambient living backdrop behind the scriptures").addDropdown((d) => {
      d.addOption("none", "None (plain)");
      d.addOption("auto", "Auto \u2014 follow the time of day");
      d.addOption("match", "\u{1F4D6} Match the chapter");
      for (const sc of SCENES) d.addOption(sc.id, `${sc.emoji} ${sc.name}`);
      d.setValue(s.device.scene ?? "none").onChange(async (v) => {
        s.device.scene = v;
        await s.saveDevice();
        this.p.scenes.apply(v);
      });
    });
    el.createEl("h2", { text: "Sharing & privacy" });
    new import_obsidian17.Setting(el).setName("Default for new notes/highlights").setDesc("\u{1F510} Only me (synced) is recommended; \u{1F512} device-only never uploads anywhere").addDropdown((d) => d.addOption("private", "\u{1F510} Only me (synced)").addOption("local", "\u{1F512} Only me (this device)").setValue(s.settings.defaultVisibility).onChange(async (v) => {
      s.settings.defaultVisibility = v;
      await this.p.saveSharedSettings();
    }));
    new import_obsidian17.Setting(el).setName("Show my marks").addToggle((t) => t.setValue(s.device.showScopes.mine).onChange(async (v) => {
      s.device.showScopes.mine = v;
      await s.saveDevice();
      s.notify();
    }));
    for (const g of s.groups) {
      new import_obsidian17.Setting(el).setName(`Show ${g.name}`).addToggle((t) => t.setValue(s.device.showScopes.groups[g.group_id] !== false).onChange(async (v) => {
        s.device.showScopes.groups[g.group_id] = v;
        await s.saveDevice();
        s.notify();
      }));
    }
    new import_obsidian17.Setting(el).setName("Show public highlights").addToggle((t) => t.setValue(s.device.showScopes.public).onChange(async (v) => {
      s.device.showScopes.public = v;
      await s.saveDevice();
      s.notify();
    }));
    el.createEl("h2", { text: "AI (your own wallet \u2014 never a shared key)" });
    if (!s.aiConnected) {
      new import_obsidian17.Setting(el).setName("Connect AI").setDesc(
        "Authorizes Scripture Graph to use YOUR OpenRouter balance. ~$10 lasts a long time."
      ).addButton((b) => b.setButtonText("Connect AI").setCta().onClick(async () => {
        await this.p.ai.beginConnect();
        new import_obsidian17.Notice("Finish in the browser \u2014 Obsidian catches the redirect. If it doesn't return, paste the code below.");
        this.display();
      }));
      new import_obsidian17.Setting(el).setName("Paste authorization code").setDesc("Only needed if the browser redirect didn't come back").addText((t) => t.setPlaceholder("code from openrouter.ai").then((t2) => {
        new import_obsidian17.Setting(el).addButton((b) => b.setButtonText("Finish connection").onClick(async () => {
          try {
            await this.p.ai.completeConnect(t2.getValue());
            this.display();
          } catch (e) {
            new import_obsidian17.Notice(e.message);
          }
        }));
      }));
    } else {
      new import_obsidian17.Setting(el).setName("AI connected \u2713").addButton((b) => b.setButtonText("Disconnect").setWarning().onClick(async () => {
        await this.p.ai.disconnect();
        this.display();
      }));
      new import_obsidian17.Setting(el).setName("Preferred models").addDropdown((d) => d.addOption("auto", "AUTO \u2014 recommended").addOption("fast", "Fast & cheap").addOption("deep", "Deep research").addOption("best", "Highest quality").addOption("cheapest", "Cheapest").addOption("specific", "Specific model\u2026").setValue(s.device.aiTier).onChange(async (v) => {
        s.device.aiTier = v;
        await s.saveDevice();
        this.display();
      }));
      if (s.device.aiTier === "specific") {
        new import_obsidian17.Setting(el).setName("Model id").setDesc("Advanced: any OpenRouter model id").addText((t) => t.setValue(s.device.aiSpecificModel ?? "").setPlaceholder(TIER_CANDIDATES.deep[0] ?? "").onChange(async (v) => {
          s.device.aiSpecificModel = v.trim() || null;
          await s.saveDevice();
        }));
      }
      new import_obsidian17.Setting(el).setName("Monthly safety cap (USD)").setDesc("Scripture Graph stops starting AI requests past this amount").addText((t) => {
        void this.p.state.budget.state().then((b) => t.setValue(String(b.capUsd)));
        t.onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) await this.p.state.budget.setCap(n);
        });
      });
      void this.p.state.budget.state().then(async (b) => {
        const wallet = await this.p.ai.wallet();
        new import_obsidian17.Setting(el).setName(
          `This month: $${b.spentUsd.toFixed(2)} / $${b.capUsd.toFixed(2)}`
        ).setDesc(wallet ? `OpenRouter wallet: $${wallet.usageUsd.toFixed(2)} used${wallet.limitUsd ? ` of $${wallet.limitUsd}` : ""}` : "");
      });
      new import_obsidian17.Setting(el).setName("Let AI read my private notes as context").setDesc("Off by default. AI never modifies your notes either way (\xA727).").addToggle((t) => t.setValue(s.device.aiUsePersonalNotes).onChange(async (v) => {
        s.device.aiUsePersonalNotes = v;
        await s.saveDevice();
      }));
    }
    el.createEl("h2", { text: "My data" });
    new import_obsidian17.Setting(el).setName("Export my data").setDesc("All annotations + highlights \u2192 Markdown/JSON in Library/Exports").addButton((b) => b.setButtonText("Export").onClick(() => void this.p.exportMyData()));
    new import_obsidian17.Setting(el).setName(`Plugin version: v${this.p.manifest.version}`).setDesc("Updates come straight from your family server \u2014 no sync games").addButton((b) => b.setButtonText("Check for updates").onClick(() => void this.p.checkForUpdate(false)));
    new import_obsidian17.Setting(el).setName("Debug: copy interaction log").setDesc("Copies what the touch layer saw (taps, selections, decisions) \u2014 paste it to whoever is fixing a bug").addButton((b) => b.setButtonText("Copy log").onClick(async () => {
      const { traceDump: traceDump2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
      await navigator.clipboard.writeText(
        `Scripture Graph v${this.p.manifest.version}
` + traceDump2()
      );
      new import_obsidian17.Notice("Interaction log copied \u2014 paste it in a message");
    })).addToggle((t) => t.setValue(s.device.debugOverlay ?? false).onChange(async (v) => {
      s.device.debugOverlay = v;
      await s.saveDevice();
      const { setOverlay: setOverlay2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
      setOverlay2(v);
    }));
    new import_obsidian17.Setting(el).setName("Server address").setDesc(
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
      new import_obsidian17.Setting(el).setName("New family account invite").addButton((b) => b.setButtonText("Create invite").onClick(async () => {
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
var CodeModal = class extends import_obsidian17.Modal {
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
    new import_obsidian17.Setting(this.contentEl).addButton((b) => b.setButtonText("Copy").setCta().onClick(async () => {
      await navigator.clipboard.writeText(this.code);
      new import_obsidian17.Notice("Copied");
    }));
    codeEl.onclick = () => void navigator.clipboard.writeText(this.code);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/migrate.ts
var import_obsidian18 = require("obsidian");
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
    new import_obsidian18.Notice(`Scripture Graph: imported ${count} highlight${count === 1 ? "" : "s"} from the old plugin (kept device-local \u2014 share any of them from the verse popover).`);
  }
}

// src/main.ts
var WriteModal = class extends import_obsidian19.Modal {
  constructor(app, chapter, onSave) {
    super(app);
    this.chapter = chapter;
    this.onSave = onSave;
  }
  onOpen() {
    this.contentEl.addClass("sg-write-modal");
    this.contentEl.createEl("h3", { text: `\u270D\uFE0F ${this.chapter} \u2014 my notes` });
    const ta = this.contentEl.createEl("textarea", {
      attr: { placeholder: "Write your thoughts\u2026 (added under My Notes)" }
    });
    new import_obsidian19.Setting(this.contentEl).addButton((b) => b.setButtonText("Save").setCta().onClick(async () => {
      const text = ta.value.trim();
      this.close();
      if (text) await this.onSave(text);
    })).addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()));
    setTimeout(() => ta.focus(), 60);
  }
  onClose() {
    this.contentEl.empty();
  }
};
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
var SGPlugin = class extends import_obsidian19.Plugin {
  state;
  ai;
  ann;
  study;
  studyBar;
  scenes = new SceneManager();
  origOpenLinkText = null;
  studyActionViews = /* @__PURE__ */ new WeakSet();
  lastReadingPath = null;
  backPillEl = null;
  bouncing = false;
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
      if (!code) return void new import_obsidian19.Notice("AI connection failed: no code in redirect");
      this.ai.completeConnect(code).catch((e) => new import_obsidian19.Notice(e.message));
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
        if (!hit) return void new import_obsidian19.Notice("Select some scripture text first");
        const vis = this.state.settings.defaultVisibility === "local" ? "local" : "private";
        void this.ann.addHighlight(hit.verseId, "yellow", hit.verseText, hit.selected, vis, null);
        new import_obsidian19.Notice(`Highlighted ${verseDisplay(hit.verseId) ?? hit.verseId}`);
      }
    });
    this.addCommand({
      id: "note-selection",
      name: "Add note on selection",
      icon: "pencil",
      callback: () => {
        const hit = resolveSelection(this.state, null);
        if (!hit) return void new import_obsidian19.Notice("Select some scripture text first");
        new NoteModal(this.state, verseDisplay(hit.verseId) ?? hit.verseId, (text) => {
          const vis = this.state.settings.defaultVisibility === "local" ? "local" : "private";
          void this.ann.addNote(hit.verseId, text, hit.selected, vis, null);
          new import_obsidian19.Notice("Note saved");
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
      id: "open-navigator",
      name: "Navigate scriptures (books & chapters)",
      icon: "compass",
      callback: () => this.openNavigator()
    });
    this.registerView(TIMELINE_VIEW, (leaf) => new TimelineView(leaf, this.state));
    this.addCommand({
      id: "open-timeline",
      name: "Open the timeline",
      icon: "history",
      callback: () => void this.openTimeline(null)
    });
    this.addRibbonIcon("compass", "Navigate scriptures", () => this.openNavigator());
    this.addCommand({
      id: "reading-scene",
      name: "Change reading scene",
      icon: "sunrise",
      callback: () => this.pickScene()
    });
    this.addCommand({
      id: "write-my-notes",
      name: "Write in my notes (this chapter)",
      icon: "pen-line",
      checkCallback: (checking) => {
        const f = this.app.workspace.getActiveFile();
        let target = null;
        if (f?.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
          target = f;
        } else if (f?.path.startsWith(CANONICAL_PREFIX) && chapterIdFromTitle(f.basename)) {
          const dest = this.app.metadataCache.getFirstLinkpathDest(
            `${f.basename} - My Notes`,
            ""
          );
          if (dest) target = dest;
        }
        if (!checking && target) void this.writeInMyNotes(target);
        return !!target;
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
        if (!sel) return void new import_obsidian19.Notice("Select the text for the card back first");
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
        new import_obsidian19.Notice("Synced");
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
    const fab = document.body.createDiv({ cls: "sg-nav-fab" });
    fab.setText("\u{1F4D6}");
    fab.setAttr("aria-label", "Navigate scriptures");
    fab.onclick = () => this.openNavigator();
    this.register(() => fab.remove());
    const back = document.body.createDiv({ cls: "sg-back-pill" });
    back.onclick = () => {
      const p = this.lastReadingPath;
      const f = p ? this.app.vault.getAbstractFileByPath(p) : null;
      if (f instanceof import_obsidian19.TFile) void this.app.workspace.getLeaf().openFile(f);
    };
    this.register(() => back.remove());
    this.backPillEl = back;
    registerSwipeNav(this, this.state, (title) => this.openMyStudy(title));
    document.body.toggleClass("sg-hide-ai-lib", !this.state.device.showAiLibrary);
    this.register(() => {
      document.body.removeClass("sg-hide-ai-lib");
      document.body.removeClass("sg-fab-on");
      document.body.removeClass("sg-back-on");
    });
    this.registerEvent(this.app.workspace.on("file-open", (f) => {
      if (!f) return;
      this.studyBar.clear();
      closeAllSheets();
      if (this.bounceAiPage(f)) return;
      this.study.recordVisit(f);
      this.recordLastChapter(f);
      this.updateNavFab(f);
      this.updateBackPill(f);
      this.updateViewChrome(f);
      this.enforceReadOnly();
      void this.matchSceneToChapter(f);
      this.openInPreviewOnce(f);
      this.addMyStudyAction(f);
    }));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.enforceReadOnly()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.enforceReadOnly()));
    this.origOpenLinkText = this.app.workspace.openLinkText.bind(this.app.workspace);
    const orig = this.origOpenLinkText;
    this.app.workspace.openLinkText = (linktext, sourcePath, newLeaf, openViewState) => {
      const peek = peekTargetFor(this.app, linktext, sourcePath);
      if (peek) {
        new VersePeekModal(this.state, peek, () => {
          void orig(linktext, sourcePath, newLeaf, openViewState);
        }).open();
        return Promise.resolve();
      }
      const sheet = sheetTargetFor(this.app, linktext, sourcePath);
      if (sheet) {
        this.openLibrarySheet(sheet, linktext.split("#")[1] ?? null);
        return Promise.resolve();
      }
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
          new import_obsidian19.Notice("Old Scripture Graph plugin retired (it kept re-enabling itself via sync)");
        }
        const seen = await this.state.store.get("last_loaded_version");
        if (seen !== this.manifest.version) {
          await this.state.store.put("last_loaded_version", this.manifest.version);
          new import_obsidian19.Notice(`Scripture Graph v${this.manifest.version} loaded`);
        }
        if (this.state.device.debugOverlay) {
          const { setOverlay: setOverlay2 } = await Promise.resolve().then(() => (init_trace(), trace_exports));
          setOverlay2(true);
        }
        const f0 = this.app.workspace.getActiveFile();
        if (f0) {
          this.recordLastChapter(f0);
          this.updateNavFab(f0);
        }
        this.scenes.apply(this.state.device.scene ?? "none");
        this.registerInterval(window.setInterval(() => {
          if (this.state.device.scene === "auto") this.scenes.apply("auto");
        }, 15 * 6e4));
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
      const mf = await (0, import_obsidian19.requestUrl)({ url: `${base}/plugin/manifest.json`, throw: false });
      if (mf.status !== 200) {
        if (!silent) new import_obsidian19.Notice("No plugin build published on the server yet");
        return;
      }
      let manifest;
      try {
        manifest = JSON.parse(mf.text.replace(/^\uFEFF/, ""));
      } catch {
        if (!silent) new import_obsidian19.Notice("Update channel returned an unreadable manifest");
        return;
      }
      const remote = manifest.version ?? "";
      if (!newerVersion(remote, this.manifest.version)) {
        if (!silent) new import_obsidian19.Notice(`Up to date \u2014 v${this.manifest.version}`);
        return;
      }
      const [main, styles] = await Promise.all([
        (0, import_obsidian19.requestUrl)({ url: `${base}/plugin/main.js`, throw: false }),
        (0, import_obsidian19.requestUrl)({ url: `${base}/plugin/styles.css`, throw: false })
      ]);
      if (main.status !== 200 || main.text.length < 1e4) {
        if (!silent) new import_obsidian19.Notice("Update download failed \u2014 try again");
        return;
      }
      const dir = `${this.app.vault.configDir}/plugins/scripture-graph`;
      const ad = this.app.vault.adapter;
      await ad.write(`${dir}/main.js`, main.text);
      if (styles.status === 200) await ad.write(`${dir}/styles.css`, styles.text);
      await ad.write(`${dir}/manifest.json`, JSON.stringify(mf.json, null, 2));
      new import_obsidian19.Notice(`Scripture Graph updated to v${remote} \u2014 reloading\u2026`, 8e3);
      window.setTimeout(() => {
        const cmds = this.app.commands;
        cmds?.executeCommandById?.("app:reload");
      }, 900);
    } catch (e) {
      if (!silent) new import_obsidian19.Notice(`Update check failed: ${e.message}`);
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
      new import_obsidian19.Notice("No My Notes page exists for this chapter yet");
    }
  }
  /** 🕰 the timeline view, optionally scrolled to a year */
  async openTimeline(year) {
    let leaf = this.app.workspace.getLeavesOfType(TIMELINE_VIEW)[0] ?? null;
    if (!leaf) {
      leaf = this.app.workspace.getLeaf(true);
      await leaf.setViewState({ type: TIMELINE_VIEW, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
    const view = leaf.view;
    if (view instanceof TimelineView && year != null) view.setYear(year);
  }
  /** the era line above verse 1 is a door into the timeline */
  async openTimelineForBook(bookSlug) {
    const { loadTimelineData: loadTimelineData2 } = await Promise.resolve().then(() => (init_timelineView(), timelineView_exports));
    const data = await loadTimelineData2(this.app);
    const y = data?.book_years?.[bookSlug] ?? null;
    await this.openTimeline(y);
  }
  /** does this page name a subject the chronology knows? (entity sheets get
   * a ⏳ door straight into that subject's focused timeline) */
  tlSubjects = null;
  tlSubjectsAt = 0;
  async timelineSubjects() {
    if (this.tlSubjects && Date.now() - this.tlSubjectsAt < 3e5) return this.tlSubjects;
    const { loadTimelineData: loadTimelineData2 } = await Promise.resolve().then(() => (init_timelineView(), timelineView_exports));
    const data = await loadTimelineData2(this.app);
    const m = /* @__PURE__ */ new Map();
    for (const e of data?.events ?? []) {
      for (const kind of ["people", "places", "things"]) {
        for (const name of e[kind] ?? []) {
          m.set(name.toLowerCase(), { kind, name });
          if (name.toLowerCase().endsWith("ies")) {
            m.set(name.toLowerCase().slice(0, -3) + "i", { kind, name });
          } else if (name.toLowerCase().endsWith("s")) {
            m.set(name.toLowerCase().slice(0, -1), { kind, name });
          }
        }
      }
    }
    this.tlSubjects = m;
    this.tlSubjectsAt = Date.now();
    return m;
  }
  /** jump to the timeline focused on one subject */
  async openTimelineFocus(subject) {
    await this.openTimeline(null);
    const leaf = this.app.workspace.getLeavesOfType(TIMELINE_VIEW)[0];
    const view = leaf?.view;
    if (view instanceof TimelineView) view.setFocus(subject);
  }
  /** 📖 Volume → book → chapter in three taps; lands on My Study pages. */
  openNavigator() {
    new SGNavigatorModal(this.app, {
      openChapter: (t) => this.openMyStudy(t),
      openNote: (l) => void (this.origOpenLinkText ?? this.app.workspace.openLinkText)(l, ""),
      lastChapter: () => this.state.device.lastChapter,
      recentChapters: () => this.state.device.recentChapters ?? [],
      groupActivity: async () => {
        if (!this.state.device.deviceToken) return [];
        return (await this.state.api.groupActivity()).activity;
      },
      listFolder: (path) => {
        const af = this.app.vault.getAbstractFileByPath(path);
        const folders = [];
        const files = [];
        if (af instanceof import_obsidian19.TFolder) {
          for (const ch of af.children) {
            if (ch instanceof import_obsidian19.TFolder) {
              folders.push({ name: ch.name, path: ch.path });
            } else if (ch instanceof import_obsidian19.TFile && ch.extension === "md" && !ch.basename.startsWith("_")) {
              files.push({ name: ch.basename, path: ch.path });
            }
          }
          folders.sort((a, b) => a.name.localeCompare(b.name));
          files.sort((a, b) => a.name.localeCompare(b.name));
        }
        return { folders, files };
      },
      openPath: (path) => {
        void this.app.workspace.openLinkText(path, "");
      },
      openTimeline: () => void this.openTimeline(null)
    }).open();
  }
  /** Remember where the reader is — powers Continue + the Recent row. */
  recordLastChapter(f) {
    let title = null;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes")) {
      title = f.basename.slice(0, -" - My Notes".length);
    } else if (f.path.startsWith(CANONICAL_PREFIX)) {
      title = f.basename;
    }
    const slug = title ? chapterIdFromTitle(title) : null;
    if (!title || !slug) return;
    const d = this.state.device;
    if (d.lastChapter?.slug === slug) return;
    d.lastChapter = { slug, title };
    d.recentChapters = [
      { slug, title, at: (/* @__PURE__ */ new Date()).toISOString() },
      ...(d.recentChapters ?? []).filter((r) => r.slug !== slug)
    ].slice(0, 8);
    void this.state.saveDevice();
  }
  /** AI Library content floats over the reading page instead of replacing
   * it. The ↗ open-as-page path exists only in power mode (the same toggle
   * that shows the AI Library folder) — for the family it simply isn't there. */
  openLibrarySheet(file, subpath) {
    const openAsPage = this.state.device.showAiLibrary ? (f) => {
      void this.app.workspace.getLeaf().openFile(f);
    } : null;
    void this.timelineSubjects();
    new LibraryPreviewModal(this.state, file, subpath, openAsPage, {
      subjectFor: (name) => this.tlSubjects?.get(name.toLowerCase()) ?? null,
      focus: (subject) => void this.openTimelineFocus(subject)
    }).open();
  }
  /** An AI Library page (other than scripture) just opened as a PAGE — bounce
   * back to where the reader was and float the content as a sheet instead.
   * This is the safety net under every routing rule: it doesn't matter how
   * the page was reached. Power mode (showAiLibrary) disables the bounce. */
  bounceAiPage(f) {
    if (this.bouncing) return false;
    if (this.state.device.showAiLibrary) return false;
    if (!f.path.startsWith(LIBRARY_PREFIX)) return false;
    if (f.path.startsWith(CANONICAL_PREFIX) || f.path.startsWith(ANNOTATED_PREFIX)) return false;
    this.bouncing = true;
    const ret = this.lastReadingPath ? this.app.vault.getAbstractFileByPath(this.lastReadingPath) : null;
    const home = ret instanceof import_obsidian19.TFile ? ret : this.app.metadataCache.getFirstLinkpathDest("Study Hub", "");
    const leaf = this.app.workspace.getLeaf();
    const nav = home instanceof import_obsidian19.TFile ? leaf.openFile(home) : leaf.setViewState({ type: "empty" });
    void nav.catch(() => {
    }).finally(() => {
      this.bouncing = false;
      this.openLibrarySheet(f, null);
    });
    return true;
  }
  /** Scripture pages must not FEEL like a second library: the tab header's
   * folder breadcrumb ("AI Library / 01 Scriptures / …") disappears there,
   * leaving just the page name. */
  updateViewChrome(f) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian19.MarkdownView);
    if (!view || view.file?.path !== f.path) return;
    const scripture = f.path.startsWith(CANONICAL_PREFIX) || f.path.startsWith(ANNOTATED_PREFIX) || f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes");
    view.containerEl.toggleClass("sg-clean-header", scripture);
    const ours = import_obsidian19.Platform.isMobile && this.state.device.swipeNav !== false && scripture && !!chapterIdFromTitle(readingChapterTitle(f) ?? "");
    if (ours) view.contentEl.dataset.ignoreSwipe = "true";
    else delete view.contentEl.dataset.ignoreSwipe;
  }
  /** After following a link away from a chapter, one labeled tap returns. */
  updateBackPill(f) {
    const isReading = f.path.startsWith(CANONICAL_PREFIX) && !!chapterIdFromTitle(f.basename) || f.path.startsWith(PERSONAL_PREFIX) && f.basename.endsWith(" - My Notes");
    if (isReading) {
      this.lastReadingPath = f.path;
      document.body.removeClass("sg-back-on");
      return;
    }
    const target = this.lastReadingPath;
    const show = !!target && target !== f.path && !!this.app.vault.getAbstractFileByPath(target);
    if (show && this.backPillEl) {
      const base = target.split("/").pop().replace(/\.md$/, "").replace(/ - My Notes$/, "");
      this.backPillEl.setText(`\u2039 ${base}`);
    }
    document.body.toggleClass("sg-back-on", show);
  }
  /** The floating 📖 shows only while reading library/study pages. */
  updateNavFab(f) {
    const on = !!f && (f.path.startsWith(PERSONAL_PREFIX) || f.path.startsWith(LIBRARY_PREFIX));
    document.body.toggleClass("sg-fab-on", on);
  }
  /** In "match" mode the scene follows the chapter's own words.
   * A My Notes page only CONTAINS an embed reference — the scripture text
   * lives in the canonical file, so resolve to that before scoring. */
  async matchSceneToChapter(f) {
    if (this.state.device.scene !== "match") return;
    let target = null;
    if (f.path.startsWith(CANONICAL_PREFIX) && chapterIdFromTitle(f.basename)) {
      target = f;
    } else if (f.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
      const dest = this.app.metadataCache.getFirstLinkpathDest(
        f.basename.replace(/ - My Notes$/, ""),
        ""
      );
      if (dest?.path.startsWith(CANONICAL_PREFIX)) target = dest;
    }
    if (!target) return;
    try {
      const { matchScene: matchScene2 } = await Promise.resolve().then(() => (init_presence(), presence_exports));
      const slug = this.app.metadataCache.getFileCache(target)?.frontmatter?.slug;
      const text = await this.app.vault.cachedRead(target);
      this.scenes.apply(matchScene2(text, slug));
    } catch {
    }
  }
  /** Ambient scene picker. */
  pickScene() {
    const menu = new import_obsidian20.Menu();
    const set = (value, label) => {
      this.state.device.scene = value;
      void this.state.saveDevice();
      if (value === "match") {
        const f = this.app.workspace.getActiveFile();
        if (f) void this.matchSceneToChapter(f);
      } else {
        this.scenes.apply(value);
      }
      new import_obsidian19.Notice(`Reading scene: ${label}`);
    };
    menu.addItem((i) => i.setTitle("\u2716 None (plain)").onClick(() => set("none", "none")));
    menu.addItem((i) => i.setTitle("\u{1F550} Auto \u2014 follow the time of day").onClick(() => set("auto", "auto")));
    menu.addItem((i) => i.setTitle("\u{1F4D6} Match the chapter \u2014 the scene follows the words").onClick(() => set("match", "match the chapter")));
    menu.addSeparator();
    for (const s of SCENES) {
      menu.addItem((i) => i.setTitle(`${s.emoji} ${s.name}`).onClick(() => set(s.id, s.name)));
    }
    menu.showAtPosition({ x: window.innerWidth / 2 - 110, y: window.innerHeight / 3 });
  }
  /** ✍️ Write dialog: append to the My Notes section without ever putting
   * the page itself into an editor (mobile keyboard stays in the dialog). */
  async writeInMyNotes(f) {
    new WriteModal(this.app, f.basename.replace(/ - My Notes$/, ""), async (text) => {
      await this.app.vault.process(f, (c) => `${c.trimEnd()}

${text.trim()}
`);
      new import_obsidian19.Notice("Added to your notes \u270D\uFE0F");
    }).open();
  }
  /** ✏️ + 🕸 buttons in the title bar of every canonical chapter view,
   * ✍️ on My Study pages. */
  addMyStudyAction(f) {
    const view = this.app.workspace.getActiveViewOfType(import_obsidian19.MarkdownView);
    if (!view || view.file?.path !== f.path || this.studyActionViews.has(view)) return;
    if (f.path.startsWith(PERSONAL_PREFIX) && f.path.endsWith(" - My Notes.md")) {
      this.studyActionViews.add(view);
      view.addAction("feather", "Write in my notes", () => {
        const cur = view.file;
        if (cur) void this.writeInMyNotes(cur);
      });
      return;
    }
    if (!f.path.startsWith(CANONICAL_PREFIX) || !chapterIdFromTitle(f.basename)) return;
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
      const view = this.app.workspace.getActiveViewOfType(import_obsidian19.MarkdownView);
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
    window.setTimeout(flip, 1100);
  }
  /** Scripture is a study surface, not an editor. Canonical files are ALWAYS
   * flipped back to reading view (even if the user hits the pencil toggle —
   * phones have no OS read-only bit); the rest of the AI Library follows the
   * forceLibraryPreview setting. Personal Library/ files are never touched. */
  noticedReadOnly = /* @__PURE__ */ new Set();
  enforceReadOnly() {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (!(view instanceof import_obsidian19.MarkdownView) || !view.file) continue;
      const path = view.file.path;
      const canonical = path.startsWith(CANONICAL_PREFIX);
      const aiLibrary = path.startsWith(LIBRARY_PREFIX);
      const mobileStudyPage = import_obsidian19.Platform.isMobile && path.startsWith(PERSONAL_PREFIX) && path.endsWith(" - My Notes.md");
      if (!canonical && !mobileStudyPage && !(aiLibrary && this.state.settings.forceLibraryPreview)) continue;
      if (view.getMode() === "preview") continue;
      void leaf.setViewState({
        type: "markdown",
        state: { ...view.getState(), mode: "preview" }
      });
      if (canonical && !this.noticedReadOnly.has(path)) {
        this.noticedReadOnly.add(path);
        new import_obsidian19.Notice("Scripture is read-only \u2014 highlight it, or write in \u270F\uFE0F My Notes");
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
    new import_obsidian19.Notice("Exported to Library/Exports");
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
    new import_obsidian19.Notice(removed ? `Cleaned up ${removed} duplicate/junk mark${removed === 1 ? "" : "s"} \u{1F9F9}` : "Nothing to clean \u2014 your marks are tidy \u2728");
  }
  async writeExport(path, content) {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof import_obsidian19.TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(path, content);
  }
};
