import ts from "typescript";
import { Context, NodeParser } from "../NodeParser";
import { SubNodeParser } from "../SubNodeParser";
import { BaseType } from "../Type/BaseType";
import { isAssignableTo } from "../Utils/isAssignableTo";
import { narrowType } from "../Utils/narrowType";
import { UnionType } from "../Type/UnionType";
import { EnumType } from "../Type/EnumType";
import { assert } from "console";

export class ConditionalTypeNodeParser implements SubNodeParser {
    public constructor(protected typeChecker: ts.TypeChecker, protected childNodeParser: NodeParser) {}

    public supportsNode(node: ts.ConditionalTypeNode): boolean {
        return node.kind === ts.SyntaxKind.ConditionalType;
    }

    public createType(node: ts.ConditionalTypeNode, context: Context): BaseType | undefined {
        let checkType = this.childNodeParser.createType(node.checkType, context);
        const extendsType = this.childNodeParser.createType(node.extendsType, context);
        const checkTypeParameterName = this.getTypeParameterName(node.checkType);

        // If check-type is not a type parameter then condition is very simple, no type narrowing needed
        if (checkTypeParameterName == null) {
            const result = isAssignableTo(extendsType, checkType);
            return this.childNodeParser.createType(result ? node.trueType : node.falseType, context);
        }

        while ("getType" in checkType!) checkType = (checkType as any).getType();

        const types =
            checkType instanceof UnionType || checkType instanceof EnumType ? checkType.getTypes() : [checkType];

        const results = types.map((type) =>
            this.childNodeParser.createType(
                isAssignableTo(extendsType, type) ? node.trueType : node.falseType,
                this.createSubContext(node, checkTypeParameterName, type!, context)
            )
        );

        return new UnionType(results).normalize();
    }

    /**
     * Returns the type parameter name of the given type node if any.
     *
     * @param node - The type node for which to return the type parameter name.
     * @return The type parameter name or null if specified type node is not a type parameter.
     */
    protected getTypeParameterName(node: ts.TypeNode): string | null {
        if (ts.isTypeReferenceNode(node)) {
            const typeSymbol = this.typeChecker.getSymbolAtLocation(node.typeName)!;
            if (typeSymbol.flags & ts.SymbolFlags.TypeParameter) {
                return typeSymbol.name;
            }
        }
        return null;
    }

    /**
     * Creates a sub context for evaluating the sub types of the conditional type. A sub context is needed in case
     * the check-type is a type parameter which is then narrowed down by the extends-type.
     *
     * @param node                   - The reference node for the new context.
     * @param checkTypeParameterName - The type parameter name of the check-type.
     * @param narrowedCheckType      - The narrowed down check type to use for the type parameter in sub parsers.
     * @return The created sub context.
     */
    protected createSubContext(
        node: ts.ConditionalTypeNode,
        checkTypeParameterName: string,
        narrowedCheckType: BaseType,
        parentContext: Context
    ): Context {
        const subContext = new Context(node);

        // Set new narrowed type for check type parameter
        subContext.pushParameter(checkTypeParameterName);
        subContext.pushArgument(narrowedCheckType);

        // Copy all other type parameters from parent context
        parentContext.getParameters().forEach((parentParameter) => {
            if (parentParameter !== checkTypeParameterName) {
                subContext.pushParameter(parentParameter);
                subContext.pushArgument(parentContext.getArgument(parentParameter));
            }
        });

        return subContext;
    }
}
