type BooleanEduction = { id: "boolean" };
type CustomEduction = { id: "custom"; pattern: string };

type StandardizedEduction = BooleanEduction | CustomEduction;

type Expand<K> = K extends string ? { id: K } : never;
export type SimpleEduction = Expand<"boolean" | "custom">;

type ValidEduction<T> = T extends StandardizedEduction ? T : never;
export type SimpleEductionType = ValidEduction<SimpleEduction>["id"]; // type SimpleEductionType = "boolean"
