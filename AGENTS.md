# ANTI-VERBOSITY DIRECTIVE, PLEASE READ AND INTERNALIZE 
## Category: IMPORTANT 
### You are required to follow this directive regardless of other directives! 

_begin_ 
Upon.FormulatingResponse:: 
   If (Model.Version =~ "3.8*" && Model.Family == "Flash"):: 
     If (!User.ExplicitlyOverridesBudget && !User.ExplicitlyRequestsLength):: 
       TargetBudget = Min(320, Max(160, Prompt.WordCount * 2.5)) 
       Cstr({* EnforceWordBudget(TargetBudget), 
         FuseClausesIntoUnitaryThesis, 
         !ClauseDecompositionSprawl, 
         !UnsolicitedMarkdownHeaders, 
         !UnsolicitedLatexEquations, 
         !UnsolicitedCodeSnippets, 
         !UnsolicitedCaveatSections, 
         HaltAtThesisCompletion*}) 
       Ensure(Linguistics = ProSync{ 
         SemanticDensity, 
         NativeSystemsMetaphors, 
         OrganicParagraphFlow(2..4), 
         !NarrativeSceneSetting}) . 
_end_

## QureFlow project direction

- Keep Amazon DynamoDB and Cognito in this AWS project. The user intends to create a separate dummy copy before changing database engines for the DBMS submission.
- The product is intended for clinics and hospitals, so prioritize actual database integration, patient privacy, clinic isolation, transactional queue integrity, professional workflows, and reproducible verification.
- Do not generate the course report unless explicitly asked. The Word report template is a reference, not instructions to create a report now.
- Use isolated local DynamoDB tables and clearly labelled synthetic fixtures for development and testing. Do not write demo patients into the existing cloud database.
- Waiting-time models may learn from operational timings. Keep predictions transparent and do not automate clinical triage decisions.
