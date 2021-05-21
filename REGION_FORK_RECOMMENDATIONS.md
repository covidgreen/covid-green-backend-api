# Region Specific Fork Recommendations

This document describes recommendations for keeping forks of 
[covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api) 
clean while also allowing for region specific changes. For example, the New York 
State fork [project-vagabond/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api) 
contains CICD workflows specific to NYS which should not be contributed back to 
Covid Green. These recommendations adhere to the project's [Contributing Guidelines](CONTRIBUTING.md).

## Goals and When to Use

These recommendations exist for the situations when a Public Health Authority is 
basing their Covid Tracing system on Covid Green but potentially making region 
specific changes. There are 4 overall goals to these recommendations
  
1. Region specific forks will stay up-to-date with [covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api).
1. Non region specific changes will always be contributed back to [covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api).
1. Region specific changes will never be contributed back to [covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api).
1. Region specific changes will be limited in scope and never cause a merge conflict

These recommendations exist because it is reasonable to assume that individual 
Public Health Authorities may want to customize specific pieces of the Covid 
Green codebase, but wish to do so in a way that will not cause explosive merge 
conflicts. These recommendations work best when the set of region specific changes 
are limited in scope, and unless explicitly region specific, all changes are 
contributed back to [covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api).

As an example, [New York State's fork](https://github.com/project-vagabond/covid-green-backend-api) 
contains NYS specific workflow differences which cannot be contributed back to Covid Green.

## Branches

The following items are assumed to be true for these recommendations to apply.

1. `current` is the main development branch within Covid Green. 
1. Covid Green's `current` branch may be merged into any fork's `current` branch without causing merge conflicts.
1. `current` will never include region specific content

The following branches within a region's fork, and rules associated with those 
branches, will help each region stay up-to-date with Covid Green. Region specific 
branches will never exist in the Covid Green project.

For clarity, the table below assumes that the region is New York State (`nys`). 
Other regions will potentially have their own region specific branch naming 
convention. For example, Pennsylvania may use `penn`, New Jersey may use `njs`, 
Connecticut may use `conn`. 

<table>
<tr>
<th>Branch</th>
<th>Description</th>
<th>Reasoning</th>
<th>Rules</th>
</tr>
<tr>
<td>

`current`

</td>
<td>

Main code branch for the project.

</td>
<td>

The purpose is to always be up-to-date with Covid Green and have a clean slate to pull into.

</td>
<td>

1. The `current` branch will always track with Covid Green's `current` branch.

1. Region specific forks will frequently pull `current` from Covid Green to ensure it is up-to-date.

1. No PRs will be sent to or accepted into a fork's `current` branch.

1. Pushing to a fork's `current` branch is not allowed, unless as a pull from Covid Green.

</td>
</tr>

<tr>
<td>

`nys` (or `penn`, `njs`, etc...)

</td>
<td>

Region specific branch tracking against `current`

</td>
<td>

Allows regions to cleanly rebase off Covid Green without running into merge conflicts.

</td>
<td>

1. This branch will always be based off `current`.

1. This branch can contain files which don't exist in Covid Green's `current` branch.

1. The only differences between `nys` and `current` should be files that do not exist in `current`.

1. Changes in this branch are not allowed on files that exist in `current`.

1. PRs can be accepted if and only if they come from `nys-*` branches and do not contain changes to files in `current`.

</td>
</tr>

<tr>
<td>

`nys-*` (or `penn-*`, `njs-*`, etc...)

</td>
<td>

Branches containing changes to files only contained in `nys` branch.

</td>
<td>

Forces regions to keep region specific changes distinct and separate from common project changes.

</td>
<td>

1. These branches must start with `nys-` (or `penn-`, `njs-`, etc...).

1. These branches must only contain updates to region specific files.

1. Files in `current` may not be edited in these branches.

1. These branches may only be PR'd into a region's main branch (`nys`, `penn`, `njs`, etc...).

</td>
</tr>
<tr>
<td>

`cg-*`

</td>
<td>

Branches containing changes to files in the `current` branch.

</td>
<td>

1. Forces regions to keep common changes distinct and separate from region specific changes.

1. Ensures that common changes are contributed back to Covid Green's `current` branch.

1. Ensures that common changes are accepted into Covid Green before existing in a region's `current` branch.

</td>
<td>

1. These branches must start with `cg-`.

1. These branches must only contain updates to common project files.

1. Region specific files cannot be edited in this branches.

1. PRs may only be sent to Covid Green's `current` branch.

</td>
</tr>
</table>

## Staying Up to Date

Periodic pulls from [covidgreen/covid-green-backend-api](https://github.com/covidgreen/covid-green-backend-api) 
will be necessary for a region specific fork to stay up to date with Covid Green. 
The following process can be used to reduce conflicts during these pulls.

The examples assume the following configured remotes:

```bash
$> git remote -v
green	git@github.com:covidgreen/covid-green-backend-api.git (fetch)
green	git@github.com:covidgreen/covid-green-backend-api.git (push)
vagabond	git@github.com:project-vagabond/covid-green-backend-api.git (fetch)
vagabond	git@github.com:project-vagabond/covid-green-backend-api.git (push)
  ## vagabond is the NYS fork of Covid Green

```

```bash
# Switch to `current` branch 
$> git co current

# Fetch changes from Covid Green
$> git fetch green

# Merge Covid Green's `current` into the fork's `current`
# Due to the rules above no merge conflicts should ever appear during this step.
$> git merge green/current

# NOTE: the fetch and merge can be done with a `git pull` if you'd rather single-step it

# Rebase region specific branch off updated `current`
$> git checkout nys # (or `git checkout penn`, `git checkout njs`, etc...)
$> git rebase current

# Again, due to rules above no merge conflicts should ever appear during this step. 
# A region specific branch should only contain changes in files which don't exist 
# in Covid Green. Because of this, those changes should be cleanly applicable to
# whatever has been done on `current`.
```
